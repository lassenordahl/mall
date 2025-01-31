import grpc
from concurrent import futures
from proto import embedding_pb2, embedding_pb2_grpc

class EmbeddingService(embedding_pb2_grpc.EmbeddingServiceServicer):
    def GetRelatedEmbeddings(self, request, context):
        print("Request received")
        print(request)
        response = embedding_pb2.GetRelatedEmbeddingsResponse()
        return response

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    embedding_pb2_grpc.add_EmbeddingServiceServicer_to_server(
        EmbeddingService(), server
    )
    server.add_insecure_port('[::]:50051')
    server.start()
    print("Embedding service running on port 50051")
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
