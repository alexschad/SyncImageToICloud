//
//  VanguRNCloudLibrary.swift
//  SyncImageToICloud
//
//  Created by Alexander Schad on 16.03.21.
//

import Foundation

@objc(VanguRNCloudLibrary)

class VanguRNCloudLibrary: RCTEventEmitter {

  override static func moduleName() -> String!{
    return "VanguRNCloudLibrary";
  }
  
  override static func requiresMainQueueSetup () -> Bool {
    return true;
  }

  var hasListener: Bool = false

  override func startObserving() {
    hasListener = true
  }

  override func stopObserving() {
    hasListener = false
  }

  @objc
  override func supportedEvents() -> [String]! {
    return ["ImageDownloaded"];
  }

  // return the app icloud document folder
  func iCloudURL() -> (String?, URL?) {
    let DOCUMENTS_DIRECTORY = "Documents"
    var iCloudError:String? = nil
    var containerUrl: URL? {
        return FileManager.default.url(forUbiquityContainerIdentifier: nil)?.appendingPathComponent(DOCUMENTS_DIRECTORY)
    }
    // check for container existence
    if let url = containerUrl, !FileManager.default.fileExists(atPath: url.path, isDirectory: nil) {
        do {
            try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true, attributes: nil)
        }
        catch {
          iCloudError = error.localizedDescription
        }
    }
    return (iCloudError, containerUrl)
  }

  // calls a react native callback funtcion with the app icloud document folder path
  @objc
  func loadICloudFolderURL(_ callback:(RCTResponseSenderBlock)) -> Void {
    let (error, url) = iCloudURL()
    let path = url?.path ?? ""
    if error != nil {
      callback([error ?? "", path]);
    } else {
      callback([NSNull(), path]);
    }
  }

  // loads the data for a file on the given url
  func loadDataFromFile(uri: URL) -> Data? {
      if let data = try? Data(contentsOf: uri) {
          return data
      }
      return nil
  }

  // copies a file from the temporary folder to the icloud document folder
  @objc
  func copyImageToIcloud(_ uri: NSString, filename: NSString, cb callback: RCTResponseSenderBlock) -> Void {
    let fileUrl1 = URL(fileURLWithPath: uri as String)
    var message:String = "copyImageToIcloud uri: \(uri) fileUrl1: \(fileUrl1)"
    let (_, cloudurl) = iCloudURL()
    let tmpFileUrl = FileManager.default.temporaryDirectory.appendingPathComponent(filename as String)
    let data = loadDataFromFile(uri: tmpFileUrl)
    if let cURL = cloudurl {
          let cFileUrl = cURL.appendingPathComponent(filename as String)
          do {
            try data?.write(to: cFileUrl, options: .atomic)
            message = """
  WRITTEN TO: \(cFileUrl)
"""
            callback([NSNull(), message])
            return
          } catch (let error) {
            callback([error, NSNull()])
            return
          }

    }
  }
  
  // download a file from the icloud to the device and send the ImageDownloaded Event to react native when finished
  @objc
  func downloadImageFromIcloud(_ filename: NSString, cb callback: RCTResponseSenderBlock) -> Void {
    let query = NSMetadataQuery()
    query.predicate = NSPredicate(format: "(%K = %@)", argumentArray: [NSMetadataItemFSNameKey, filename])
    query.searchScopes = [NSMetadataQueryUbiquitousDocumentsScope]

    NotificationCenter.default.addObserver(forName: .NSMetadataQueryDidUpdate, object: query, queue: nil) { notification in
      for i in 0..<query.resultCount {
        if let item = query.result(at: i) as? NSMetadataItem {
          let downloadingStatus = item.value(forAttribute: NSMetadataUbiquitousItemDownloadingStatusKey) as! String
          print (downloadingStatus)
          if downloadingStatus == NSMetadataUbiquitousItemDownloadingStatusCurrent {
            // file is donwloaded, notify react native
            if self.hasListener {
              self.sendEvent(withName:"ImageDownloaded", body:["filename": filename])
            }
          }
        }
      }
    }
    DispatchQueue.main.async {
        query.start()
    }


    let fileManager = FileManager.default
    // Browse your icloud container to find the file you want
    var message:String = ""
    if let icloudImageURL = fileManager.url(forUbiquityContainerIdentifier: nil)?.appendingPathComponent("Documents").appendingPathComponent(filename as String) {
      // Here select the file url you are interested in
        // We have the url we want to download into myURL variable
      do {
        try fileManager.startDownloadingUbiquitousItem(at:icloudImageURL)
        message = """
File Donwloading
"""
        callback([NSNull(), message])
      } catch (let error) {
        callback([error, NSNull()])
      }
    }
  }

  // checks if the file is already downloaded or still in the cloud and calls the callback with "disk", "cloud" or "File doesn't exist"
  @objc
  func checkFileLocation(_ filename: NSString, cb callback: RCTResponseSenderBlock) -> Void {
    let fileManager = FileManager.default
    if let icloudImageURL = fileManager.url(forUbiquityContainerIdentifier: nil)?.appendingPathComponent("Documents").appendingPathComponent(filename as String) {
      if fileManager.fileExists(atPath: icloudImageURL.path) {
        callback([NSNull(), "disk"])
        return
      }
    }

    let cloudFilename = ".\(filename).icloud"
    if let icloudImageURL = fileManager.url(forUbiquityContainerIdentifier: nil)?.appendingPathComponent("Documents").appendingPathComponent(cloudFilename as String) {
      if fileManager.fileExists(atPath: icloudImageURL.path) {
        callback([NSNull(), "cloud"])
        return
      }
    }
    callback(["File doesn't exist", NSNull()])
  }
}
