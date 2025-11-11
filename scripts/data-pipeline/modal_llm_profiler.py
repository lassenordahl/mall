"""
Modal-based LLM semantic profiler
Uses Phi-3-mini (3.8B, Microsoft) to generate structured semantic profiles
"""

import modal
import json
from typing import List, Dict
from datetime import datetime

# Create Modal app
app = modal.App("llm-profiler")

# Simple image with transformers
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "transformers==4.40.0",
        "torch==2.3.0",
        "accelerate==0.30.0"
    )
)

MODEL_NAME = "microsoft/Phi-3-mini-128k-instruct"


@app.cls(
    image=image,
    gpu="A10G",
    timeout=3600,
    scaledown_window=300,
)
class LLMProfiler:
    @modal.enter()
    def load_model(self):
        """Load model once when container starts"""
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM

        print("Loading Phi-3-mini (3.8B) model...")

        self.tokenizer = AutoTokenizer.from_pretrained(
            MODEL_NAME,
            trust_remote_code=True
        )

        self.model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            torch_dtype=torch.float16,
            device_map="cuda",
            trust_remote_code=True
        )

        self.model.eval()
        print(f"Model loaded on GPU!")

    @modal.method()
    def generate_profiles_batch(self, domains: List[str]) -> List[Dict]:
        """
        Generate structured semantic profiles using Phi-3-mini
        """
        import torch

        # Create prompt
        user_prompt = f"""For each domain below, provide a structured semantic profile in JSON format.

Domains to analyze:
{chr(10).join(f"{i+1}. {domain}" for i, domain in enumerate(domains))}

For each domain, provide these fields:
- domain: The domain name
- category: Primary category (e.g., "Search Engine", "News & Media", "E-commerce", "Developer Tools", "Social Media", "Entertainment")
- subcategories: Array of 2-4 specific subcategories
- purpose: One clear sentence describing what the site does
- audience: Who primarily uses this site
- content_types: Array of content types (e.g., ["articles", "videos", "products", "code", "discussions"])
- primary_topics: Array of 3-5 main topics/domains covered
- tone: Overall tone (e.g., "professional", "casual", "technical", "authoritative")

If you don't know a domain, set category to "Unknown" and provide minimal details.

Output ONLY a valid JSON array with one object per domain. No markdown, no explanation, just the JSON array."""

        messages = [
            {"role": "system", "content": "You are a web categorization expert. Provide accurate, concise structured data about websites in JSON format."},
            {"role": "user", "content": user_prompt}
        ]

        try:
            # Tokenize
            inputs = self.tokenizer.apply_chat_template(
                messages,
                add_generation_prompt=True,
                return_tensors="pt"
            ).to("cuda")

            # Generate (reduced tokens for smaller batches)
            with torch.no_grad():
                outputs = self.model.generate(
                    inputs,
                    max_new_tokens=1500,
                    temperature=0.3,
                    do_sample=True,
                    top_p=0.9,
                    pad_token_id=self.tokenizer.eos_token_id,
                    eos_token_id=self.tokenizer.eos_token_id
                )

            # Decode
            response = self.tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True)
            content = response.strip()

            print(f"Raw model output length: {len(content)} chars")
            print(f"First 300 chars: {content[:300]}")
            print(f"Last 300 chars: {content[-300:]}")

            # Remove markdown code blocks if present
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            # Try to extract JSON array using regex (handles text before/after)
            import re
            json_match = re.search(r'\[\s*\{.*\}\s*\]', content, re.DOTALL)
            if json_match:
                content = json_match.group(0)
                print(f"Extracted JSON array: {len(content)} chars")

            # Parse JSON
            try:
                profiles = json.loads(content)
            except json.JSONDecodeError as e:
                print(f"JSON Parse Error: {e}")
                print(f"Content causing error (first 500): {content[:500]}")
                print(f"Content causing error (last 500): {content[-500:]}")
                raise

            # Add metadata
            for profile in profiles:
                profile['data_source'] = 'llm'
                profile['confidence'] = 'high' if profile.get('category') != 'Unknown' else 'unknown'
                profile['generated_at'] = datetime.utcnow().isoformat()

            return profiles

        except Exception as e:
            print(f"Error generating profiles: {e}")
            # Return error objects for failed domains
            return [
                {
                    'domain': domain,
                    'category': 'Error',
                    'error': str(e),
                    'data_source': 'llm',
                    'confidence': 'unknown',
                    'generated_at': datetime.utcnow().isoformat()
                }
                for domain in domains
            ]


@app.local_entrypoint()
def profile_sample():
    """Generate semantic profiles for sample dataset"""
    import os

    input_file = "scripts/data-pipeline/output/tranco-top-1m.csv"
    output_file = "scripts/data-pipeline/output/profiles-sample.jsonl"

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    print("Reading domains from Tranco list...")
    with open(input_file, 'r') as f:
        domains = [line.strip().split(',')[1] for line in f.readlines()[:1000]]

    print(f"Generating semantic profiles for {len(domains)} domains with Phi-3-mini (3.8B)...")
    print("This will take ~5-7 minutes on Modal GPU...")

    # Process in batches of 5 (smaller batches for better JSON generation)
    batch_size = 5
    batches = [domains[i:i+batch_size] for i in range(0, len(domains), batch_size)]

    print(f"Processing {len(batches)} batches...")

    # Create profiler instance
    profiler = LLMProfiler()

    all_profiles = []
    for i, batch in enumerate(batches):
        profiles = profiler.generate_profiles_batch.remote(batch)
        all_profiles.extend(profiles)
        if (i + 1) % 5 == 0:
            print(f"  Processed {len(all_profiles)}/{len(domains)} domains...")

    # Write results
    print(f"\nWriting profiles to {output_file}...")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        for profile in all_profiles:
            f.write(json.dumps(profile) + '\n')

    # Statistics
    high_confidence = sum(1 for p in all_profiles if p.get('confidence') == 'high')
    unknown = sum(1 for p in all_profiles if p.get('category') == 'Unknown' or p.get('category') == 'Error')

    print(f"\nResults:")
    print(f"  Total profiles: {len(all_profiles)}")
    print(f"  High confidence: {high_confidence} ({100*high_confidence/len(all_profiles):.1f}%)")
    print(f"  Unknown/Error: {unknown} ({100*unknown/len(all_profiles):.1f}%)")
    print(f"  Output: {output_file}")

    # Show some examples
    print(f"\nExample profiles:")
    for profile in all_profiles[:5]:
        print(f"\n  {profile['domain']}:")
        print(f"    Category: {profile.get('category', 'N/A')}")
        print(f"    Purpose: {profile.get('purpose', 'N/A')[:60]}...")


@app.local_entrypoint()
def profile_full():
    """Generate semantic profiles for full dataset"""
    import os

    input_file = "scripts/data-pipeline/output/tranco-top-1m.csv"
    output_file = "scripts/data-pipeline/output/profiles-full.jsonl"

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    print("Reading domains from Tranco list...")
    with open(input_file, 'r') as f:
        domains = [line.strip().split(',')[1] for line in f.readlines()]

    print(f"Generating semantic profiles for {len(domains)} domains with Phi-3-mini (3.8B)...")
    print("This will take ~90-120 minutes on Modal GPU...")
    print(f"Estimated cost: ~$10-15 (Modal credits)")

    # Process in batches of 20
    batch_size = 20
    batches = [domains[i:i+batch_size] for i in range(0, len(domains), batch_size)]

    print(f"Processing {len(batches)} batches...")

    # Create profiler instance
    profiler = LLMProfiler()

    all_profiles = []
    for i, batch in enumerate(batches):
        profiles = profiler.generate_profiles_batch.remote(batch)
        all_profiles.extend(profiles)
        if (i + 1) % 50 == 0:
            print(f"  Processed {len(all_profiles)}/{len(domains)} domains...")

    # Write results
    print(f"\nWriting profiles to {output_file}...")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        for profile in all_profiles:
            f.write(json.dumps(profile) + '\n')

    # Statistics
    high_confidence = sum(1 for p in all_profiles if p.get('confidence') == 'high')
    unknown = sum(1 for p in all_profiles if p.get('category') == 'Unknown' or p.get('category') == 'Error')

    print(f"\nResults:")
    print(f"  Total profiles: {len(all_profiles)}")
    print(f"  High confidence: {high_confidence} ({100*high_confidence/len(all_profiles):.1f}%)")
    print(f"  Unknown/Error: {unknown} ({100*unknown/len(all_profiles):.1f}%)")
    print(f"  Output: {output_file}")
