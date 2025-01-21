package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	pb "github.com/lassenordahl/mall/proto"
	"google.golang.org/grpc"
)

type server struct{}

func (s *server) getEmbeddings(w http.ResponseWriter, r *http.Request) {
  conn, err := grpc.Dial("localhost:50051", grpc.WithInsecure())
	if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
  	return
	}

	defer conn.Close()

  client := pb.NewEmbeddingServiceClient(conn)

  resp, err := client.GetRelatedEmbeddings(context.Background(), &pb.GetRelatedEmbeddingsRequest{
		WebsiteIds: []string{"1", "2"},
  })
  if err != nil {
    http.Error(w, err.Error(), http.StatusInternalServerError)
    return
 	}

	w.Header().Set("Content-Type", "application/json")
  json.NewEncoder(w).Encode(resp)
}

func main() {
	s := &server{}
	http.HandleFunc("/embeddings", s.getEmbeddings)

	log.Printf("REST server listening on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
