# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: api.proto
"""Generated protocol buffer code."""
from google.protobuf.internal import builder as _builder
from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()




DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(b'\n\tapi.proto\x12\x07test.v1\"*\n\x04Ping\x12\x0f\n\x07message\x18\x01 \x01(\t\x12\x11\n\ttimestamp\x18\x02 \x01(\x03\"*\n\x0bPingRequest\x12\x1b\n\x04ping\x18\x01 \x01(\x0b\x32\r.test.v1.Ping\"<\n\x0cPingResponse\x12\x1b\n\x04ping\x18\x01 \x01(\x0b\x32\r.test.v1.Ping\x12\x0f\n\x07success\x18\x02 \x01(\x08\"Z\n\x07Website\x12\x0e\n\x06string\x18\x01 \x01(\t\x12\x0c\n\x04rank\x18\x02 \x01(\x05\x12\x0e\n\x06\x64omain\x18\x03 \x01(\t\x12\x0c\n\x04meta\x18\x04 \x01(\t\x12\x13\n\x0b\x64\x65scription\x18\x05 \x01(\t\"\"\n\nCoordinate\x12\t\n\x01x\x18\x01 \x01(\x05\x12\t\n\x01y\x18\x02 \x01(\x05\"_\n\x11\x43oordinateWebsite\x12\'\n\ncoordinate\x18\x01 \x01(\x0b\x32\x13.test.v1.Coordinate\x12!\n\x07website\x18\x02 \x01(\x0b\x32\x10.test.v1.Website\"-\n\x12GetWebsitesRequest\x12\x17\n\x0fpov_website_ids\x18\x01 \x03(\t\"N\n\x13GetWebsitesResponse\x12\x37\n\x13\x63oordinate_websites\x18\x01 \x03(\x0b\x32\x1a.test.v1.CoordinateWebsite2F\n\x0bTestService\x12\x37\n\x08SendPing\x12\x14.test.v1.PingRequest\x1a\x15.test.v1.PingResponse2^\n\x0e\x43onsoleService\x12L\n\x0eGetNewWebsites\x12\x1c.test.v1.GetWebsitesResponse\x1a\x1c.test.v1.GetWebsitesResponseB1Z/github.com/lassenordahl/mall/server/proto;protob\x06proto3')

_builder.BuildMessageAndEnumDescriptors(DESCRIPTOR, globals())
_builder.BuildTopDescriptorsAndMessages(DESCRIPTOR, 'api_pb2', globals())
if _descriptor._USE_C_DESCRIPTORS == False:

  DESCRIPTOR._options = None
  DESCRIPTOR._serialized_options = b'Z/github.com/lassenordahl/mall/server/proto;proto'
  _PING._serialized_start=22
  _PING._serialized_end=64
  _PINGREQUEST._serialized_start=66
  _PINGREQUEST._serialized_end=108
  _PINGRESPONSE._serialized_start=110
  _PINGRESPONSE._serialized_end=170
  _WEBSITE._serialized_start=172
  _WEBSITE._serialized_end=262
  _COORDINATE._serialized_start=264
  _COORDINATE._serialized_end=298
  _COORDINATEWEBSITE._serialized_start=300
  _COORDINATEWEBSITE._serialized_end=395
  _GETWEBSITESREQUEST._serialized_start=397
  _GETWEBSITESREQUEST._serialized_end=442
  _GETWEBSITESRESPONSE._serialized_start=444
  _GETWEBSITESRESPONSE._serialized_end=522
  _TESTSERVICE._serialized_start=524
  _TESTSERVICE._serialized_end=594
  _CONSOLESERVICE._serialized_start=596
  _CONSOLESERVICE._serialized_end=690
# @@protoc_insertion_point(module_scope)
