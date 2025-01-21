package main

import (
	"context"
	"log"
	"net"
	"time"

	pb "github.com/lassenordahl/mall/proto"
	"google.golang.org/grpc"
)

type server struct {
    pb.UnimplementedTestServiceServer
}

func (s *server) SendPing(ctx context.Context,  req*pb.PingRequest) (*pb.PingResponse, error) {
    return &pb.PingResponse{
        Ping: &pb.Ping{
            Message:   "Hello " + req.Ping.Message,
            Timestamp: time.Now().Unix(),
        },
        Success: true,
    }, nil
}

func main() {
    lis, err := net.Listen("tcp", ":50051")
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }

    s := grpc.NewServer()
    pb.RegisterTestServiceServer(s, &server{})

    log.Printf("Server listening on :50051")
    if err := s.Serve(lis); err != nil {
        log.Fatalf("failed to serve: %v", err)
    }
}
