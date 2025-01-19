// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.36.3
// 	protoc        v5.29.3
// source: proto/api.proto

package testv1

import (
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

// Test message to verify our setup
type Ping struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	Message       string                 `protobuf:"bytes,1,opt,name=message,proto3" json:"message,omitempty"`
	Timestamp     int64                  `protobuf:"varint,2,opt,name=timestamp,proto3" json:"timestamp,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *Ping) Reset() {
	*x = Ping{}
	mi := &file_proto_api_proto_msgTypes[0]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *Ping) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*Ping) ProtoMessage() {}

func (x *Ping) ProtoReflect() protoreflect.Message {
	mi := &file_proto_api_proto_msgTypes[0]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use Ping.ProtoReflect.Descriptor instead.
func (*Ping) Descriptor() ([]byte, []int) {
	return file_proto_api_proto_rawDescGZIP(), []int{0}
}

func (x *Ping) GetMessage() string {
	if x != nil {
		return x.Message
	}
	return ""
}

func (x *Ping) GetTimestamp() int64 {
	if x != nil {
		return x.Timestamp
	}
	return 0
}

type PingRequest struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	Ping          *Ping                  `protobuf:"bytes,1,opt,name=ping,proto3" json:"ping,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *PingRequest) Reset() {
	*x = PingRequest{}
	mi := &file_proto_api_proto_msgTypes[1]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *PingRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*PingRequest) ProtoMessage() {}

func (x *PingRequest) ProtoReflect() protoreflect.Message {
	mi := &file_proto_api_proto_msgTypes[1]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use PingRequest.ProtoReflect.Descriptor instead.
func (*PingRequest) Descriptor() ([]byte, []int) {
	return file_proto_api_proto_rawDescGZIP(), []int{1}
}

func (x *PingRequest) GetPing() *Ping {
	if x != nil {
		return x.Ping
	}
	return nil
}

type PingResponse struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	Ping          *Ping                  `protobuf:"bytes,1,opt,name=ping,proto3" json:"ping,omitempty"`
	Success       bool                   `protobuf:"varint,2,opt,name=success,proto3" json:"success,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *PingResponse) Reset() {
	*x = PingResponse{}
	mi := &file_proto_api_proto_msgTypes[2]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *PingResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*PingResponse) ProtoMessage() {}

func (x *PingResponse) ProtoReflect() protoreflect.Message {
	mi := &file_proto_api_proto_msgTypes[2]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use PingResponse.ProtoReflect.Descriptor instead.
func (*PingResponse) Descriptor() ([]byte, []int) {
	return file_proto_api_proto_rawDescGZIP(), []int{2}
}

func (x *PingResponse) GetPing() *Ping {
	if x != nil {
		return x.Ping
	}
	return nil
}

func (x *PingResponse) GetSuccess() bool {
	if x != nil {
		return x.Success
	}
	return false
}

var File_proto_api_proto protoreflect.FileDescriptor

var file_proto_api_proto_rawDesc = []byte{
	0x0a, 0x0f, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x2f, 0x61, 0x70, 0x69, 0x2e, 0x70, 0x72, 0x6f, 0x74,
	0x6f, 0x12, 0x07, 0x74, 0x65, 0x73, 0x74, 0x2e, 0x76, 0x31, 0x22, 0x3e, 0x0a, 0x04, 0x50, 0x69,
	0x6e, 0x67, 0x12, 0x18, 0x0a, 0x07, 0x6d, 0x65, 0x73, 0x73, 0x61, 0x67, 0x65, 0x18, 0x01, 0x20,
	0x01, 0x28, 0x09, 0x52, 0x07, 0x6d, 0x65, 0x73, 0x73, 0x61, 0x67, 0x65, 0x12, 0x1c, 0x0a, 0x09,
	0x74, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x18, 0x02, 0x20, 0x01, 0x28, 0x03, 0x52,
	0x09, 0x74, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x22, 0x30, 0x0a, 0x0b, 0x50, 0x69,
	0x6e, 0x67, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x12, 0x21, 0x0a, 0x04, 0x70, 0x69, 0x6e,
	0x67, 0x18, 0x01, 0x20, 0x01, 0x28, 0x0b, 0x32, 0x0d, 0x2e, 0x74, 0x65, 0x73, 0x74, 0x2e, 0x76,
	0x31, 0x2e, 0x50, 0x69, 0x6e, 0x67, 0x52, 0x04, 0x70, 0x69, 0x6e, 0x67, 0x22, 0x4b, 0x0a, 0x0c,
	0x50, 0x69, 0x6e, 0x67, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x12, 0x21, 0x0a, 0x04,
	0x70, 0x69, 0x6e, 0x67, 0x18, 0x01, 0x20, 0x01, 0x28, 0x0b, 0x32, 0x0d, 0x2e, 0x74, 0x65, 0x73,
	0x74, 0x2e, 0x76, 0x31, 0x2e, 0x50, 0x69, 0x6e, 0x67, 0x52, 0x04, 0x70, 0x69, 0x6e, 0x67, 0x12,
	0x18, 0x0a, 0x07, 0x73, 0x75, 0x63, 0x63, 0x65, 0x73, 0x73, 0x18, 0x02, 0x20, 0x01, 0x28, 0x08,
	0x52, 0x07, 0x73, 0x75, 0x63, 0x63, 0x65, 0x73, 0x73, 0x32, 0x46, 0x0a, 0x0b, 0x54, 0x65, 0x73,
	0x74, 0x53, 0x65, 0x72, 0x76, 0x69, 0x63, 0x65, 0x12, 0x37, 0x0a, 0x08, 0x53, 0x65, 0x6e, 0x64,
	0x50, 0x69, 0x6e, 0x67, 0x12, 0x14, 0x2e, 0x74, 0x65, 0x73, 0x74, 0x2e, 0x76, 0x31, 0x2e, 0x50,
	0x69, 0x6e, 0x67, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x1a, 0x15, 0x2e, 0x74, 0x65, 0x73,
	0x74, 0x2e, 0x76, 0x31, 0x2e, 0x50, 0x69, 0x6e, 0x67, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73,
	0x65, 0x42, 0x1a, 0x5a, 0x18, 0x67, 0x65, 0x6e, 0x65, 0x72, 0x61, 0x74, 0x65, 0x64, 0x2f, 0x74,
	0x65, 0x73, 0x74, 0x2f, 0x76, 0x31, 0x3b, 0x74, 0x65, 0x73, 0x74, 0x76, 0x31, 0x62, 0x06, 0x70,
	0x72, 0x6f, 0x74, 0x6f, 0x33,
}

var (
	file_proto_api_proto_rawDescOnce sync.Once
	file_proto_api_proto_rawDescData = file_proto_api_proto_rawDesc
)

func file_proto_api_proto_rawDescGZIP() []byte {
	file_proto_api_proto_rawDescOnce.Do(func() {
		file_proto_api_proto_rawDescData = protoimpl.X.CompressGZIP(file_proto_api_proto_rawDescData)
	})
	return file_proto_api_proto_rawDescData
}

var file_proto_api_proto_msgTypes = make([]protoimpl.MessageInfo, 3)
var file_proto_api_proto_goTypes = []any{
	(*Ping)(nil),         // 0: test.v1.Ping
	(*PingRequest)(nil),  // 1: test.v1.PingRequest
	(*PingResponse)(nil), // 2: test.v1.PingResponse
}
var file_proto_api_proto_depIdxs = []int32{
	0, // 0: test.v1.PingRequest.ping:type_name -> test.v1.Ping
	0, // 1: test.v1.PingResponse.ping:type_name -> test.v1.Ping
	1, // 2: test.v1.TestService.SendPing:input_type -> test.v1.PingRequest
	2, // 3: test.v1.TestService.SendPing:output_type -> test.v1.PingResponse
	3, // [3:4] is the sub-list for method output_type
	2, // [2:3] is the sub-list for method input_type
	2, // [2:2] is the sub-list for extension type_name
	2, // [2:2] is the sub-list for extension extendee
	0, // [0:2] is the sub-list for field type_name
}

func init() { file_proto_api_proto_init() }
func file_proto_api_proto_init() {
	if File_proto_api_proto != nil {
		return
	}
	type x struct{}
	out := protoimpl.TypeBuilder{
		File: protoimpl.DescBuilder{
			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
			RawDescriptor: file_proto_api_proto_rawDesc,
			NumEnums:      0,
			NumMessages:   3,
			NumExtensions: 0,
			NumServices:   1,
		},
		GoTypes:           file_proto_api_proto_goTypes,
		DependencyIndexes: file_proto_api_proto_depIdxs,
		MessageInfos:      file_proto_api_proto_msgTypes,
	}.Build()
	File_proto_api_proto = out.File
	file_proto_api_proto_rawDesc = nil
	file_proto_api_proto_goTypes = nil
	file_proto_api_proto_depIdxs = nil
}
