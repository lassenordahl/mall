.PHONY: generate
generate: generate-go generate-ts

.PHONY: generate-go
generate-go:
	protoc --go_out=server \
		--go_opt=paths=source_relative \
		--go-grpc_out=server \
		--go-grpc_opt=paths=source_relative \
		proto/*.proto

.PHONY: generate-ts
generate-ts:
	protoc --ts_proto_out=./client/src/generated \
		--ts_proto_opt=esModuleInterop=true \
		--plugin=protoc-gen-ts_proto=./client/node_modules/.bin/protoc-gen-ts_proto \
		proto/*.proto

# Optional: Install all necessary protoc plugins
.PHONY: install-plugins
install-plugins:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	cd client && npm install @protobuf-ts/plugin
