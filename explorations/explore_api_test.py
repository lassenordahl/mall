import requests

def get_random_domain():
    response = requests.get("http://127.0.0.1:8000/random_embedding")
    if response.status_code == 200:
        return response.json()["domain"]
    else:
        print(f"Error: {response.status_code}, {response.text}")
        exit()

def get_related_domains(domains, top_n=10):
    response = requests.post(
        "http://127.0.0.1:8000/related_embeddings",
        json={"domains": domains, "top_n": top_n},
        headers={"Content-Type": "application/json"}
    )
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error: {response.status_code}, {response.text}")
        exit()

def main():
    # Start with one random domain
    current_domains = [get_random_domain()]
    print(f"Starting domain: {current_domains[0]}")

    for i in range(10):
        print(f"\nIteration {i+1}")
        print("Related domains:")
        for domain in current_domains:
            print(f"\nRelated domains for {domain}:")
        related_domains = get_related_domains(current_domains, top_n=10)
        for domain, related in related_domains.items():
            for rel in related:
                print(f"- {rel}")

        print("-----")
        # Flatten the list of related domains and remove duplicates
        current_domains = list(set([item for sublist in related_domains.values() for item in sublist]))

if __name__ == '__main__':
    main()
