//
//  VanguRNCloudLibrary.m
//  ImageCloudTest
//
//  Created by Alexander Schad on 05.03.21.
//

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(VanguRNCloudLibrary, RCTEventEmitter)
RCT_EXTERN_METHOD(loadICloudFolderURL:(RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(copyImageToIcloud:(NSString)uri filename:(NSString)filename cb:(RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(downloadImageFromIcloud:(NSString)filename cb:(RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(checkFileLocation:(NSString)filename cb:(RCTResponseSenderBlock)callback)
@end
