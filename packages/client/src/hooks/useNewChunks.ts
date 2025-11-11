import { useState, useCallback } from 'react';

/**
 * Hook to track chunks that were newly generated in this session
 * Returns a set of chunk keys like "10,-5"
 */
export function useNewChunks() {
  const [newChunks, setNewChunks] = useState<Set<string>>(new Set());

  const markAsNew = useCallback((chunkX: number, chunkZ: number) => {
    const key = `${chunkX},${chunkZ}`;
    setNewChunks(prev => {
      const next = new Set(prev);
      next.add(key);
      console.log(`[useNewChunks] Marked chunk (${chunkX}, ${chunkZ}) as NEW`);
      return next;
    });
  }, []);

  const isNew = useCallback((chunkX: number, chunkZ: number) => {
    const key = `${chunkX},${chunkZ}`;
    return newChunks.has(key);
  }, [newChunks]);

  const getNewChunkCount = useCallback(() => {
    return newChunks.size;
  }, [newChunks]);

  return {
    markAsNew,
    isNew,
    getNewChunkCount,
    newChunkKeys: Array.from(newChunks),
  };
}
