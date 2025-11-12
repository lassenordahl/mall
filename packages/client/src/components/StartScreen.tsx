import { useState, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import { getApiBaseUrl } from '@3d-neighborhood/shared';

interface Website {
  url: string;
  title: string;
  favicon: string;
}

interface StartScreenProps {
  onStart: (url: string) => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Website[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch results when query changes
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/websites?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Failed to fetch websites:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchResults, 200);
    return () => clearTimeout(debounce);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        onStart(results[selectedIndex].url);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="w-full max-w-2xl px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">3D Neighborhood</h1>
          <p className="text-muted-foreground">Enter a website to begin exploring</p>
        </div>

        <div className="relative">
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search for a website..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-14 text-lg pl-4 pr-4"
            />
            {loading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-popover border border-border rounded-md shadow-lg max-h-96 overflow-y-auto">
              {results.map((website, index) => (
                <button
                  key={website.url}
                  onClick={() => onStart(website.url)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors",
                    selectedIndex === index && "bg-accent"
                  )}
                >
                  <img
                    src={website.favicon}
                    alt=""
                    className="w-8 h-8 flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{website.url}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {website.title}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {query.length > 0 && query.length < 2 && (
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Type at least 2 characters to search
          </p>
        )}
      </div>
    </div>
  );
}
