import React, { useState, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  Text,
  StatusBar,
  ScrollView,
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  NativeEventEmitter,
  NativeModules,
} from 'react-native';

import iCloudStorage from 'react-native-icloudstore';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

const VanguRNCloudLibrary = NativeModules.VanguRNCloudLibrary;

const App = () => {
  const [imageUrl, setImageUrl] = useState();
  const [filename, setFilename] = useState('');
  const [cloudDirURL, setCloudDirURL] = useState();
  const [downloading, setDownloading] = useState(false);
  const [fileLocation, setFileLocation] = useState();

  // call native CheckFile function to check if the file is in the cloud or on disk
  const checkFileLocation = useCallback(() => {
    let timeout;
    if (!fileLocation) {
      VanguRNCloudLibrary.checkFileLocation(filename, (err, floc) => {
        if (err) {
          clearTimeout(timeout);
          timeout = setTimeout(function () {
            checkFileLocation(filename);
            setFileLocation(null);
          }, 1000);
        } else {
          setFileLocation(floc);
        }
      });
    }
    return;
  }, [fileLocation, filename]);

  // check the File location when the filename changes
  useEffect(() => {
    checkFileLocation(filename);
  }, [filename, checkFileLocation]);

  // load app data from the icloud key/value store
  const loadData = useCallback(async () => {
    try {
      const jsonValue = await iCloudStorage.getItem('@syncImageToICloud');
      let loadedData = jsonValue ? JSON.parse(jsonValue) : '';
      setFileLocation(null);
      setFilename(loadedData);
    } catch (e) {
      console.log(e);
    }
  }, []);

  // this function gets called when the icloud key/value data changes
  const loadDataEvent = useCallback(
    async (userinfo) => {
      try {
        const changedKeys = userinfo?.changedKeys;
        if (changedKeys != null && changedKeys.includes('@syncImageToICloud')) {
          await loadData();
        }
      } catch (e) {
        console.log(e);
      }
    },
    [loadData],
  );

  // setup the listener for iCloudStoreDidChangeRemotely events, gets triggerd when icloud key/value data changes
  useEffect(() => {
    const eventEmitter = new NativeEventEmitter(iCloudStorage);
    const subscription = eventEmitter.addListener(
      'iCloudStoreDidChangeRemotely',
      loadDataEvent,
    );
    loadData();
    return () => {
      subscription.remove();
    };
  }, [loadDataEvent, loadData]);

  // save the filename to the icloud key/value store
  const saveData = async (newFilename) => {
    try {
      const jsonValue = JSON.stringify(newFilename);
      iCloudStorage.setItem('@syncImageToICloud', jsonValue);
    } catch (e) {
      console.log(e);
    }
  };

  // set the image url when the filename or the cloudDirURL changes
  useEffect(() => {
    if (cloudDirURL && filename) {
      setImageUrl(`${cloudDirURL}/${filename}`);
    }
  }, [cloudDirURL, filename]);

  // setup the listener for ImageDownloaded events, gets triggerd when the download of an icloud image is finished
  useEffect(() => {
    const VanguEventEmitter = new NativeEventEmitter(VanguRNCloudLibrary);
    const subscription = VanguEventEmitter.addListener(
      'ImageDownloaded',
      (body) => {
        setDownloading(false);
        setFileLocation('disk');
      },
    );

    VanguRNCloudLibrary.loadICloudFolderURL((err, cloudFolderURL) => {
      if (!err) {
        setCloudDirURL(cloudFolderURL);
      } else {
        console.log('Error', err);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [checkFileLocation]);

  // launches the react-native-image-picker Image Library Picker
  const launchMyImageLibrary = () => {
    let options = {
      storageOptions: {
        skipBackup: true,
        path: 'images',
      },
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.customButton) {
        console.log('User tapped custom button: ', response.customButton);
      } else {
        VanguRNCloudLibrary.copyImageToIcloud(
          response.uri,
          response.fileName,
          (err, _) => {
            if (!err) {
              setFilename(response.fileName);
              saveData(response.fileName);
            } else {
              console.log(err);
            }
          },
        );
      }
    });
  };

  // renders the image depending on the image location
  const getImage = () => {
    if (downloading) {
      return <Image source={require('./assets/downloading.png')} />;
    }
    switch (fileLocation) {
      case 'cloud':
        return (
          <TouchableOpacity
            onPress={() => {
              setDownloading(true);
              VanguRNCloudLibrary.downloadImageFromIcloud(
                filename,
                (err, message) => {
                  if (err) {
                    console.log(message);
                    console.log(err);
                  }
                },
              );
            }}>
            <Image
              style={styles.image}
              source={require('./assets/cloud.png')}
            />
          </TouchableOpacity>
        );
      case 'disk':
        return (
          <TouchableOpacity onPress={launchMyImageLibrary}>
            <Image style={styles.image} source={{ uri: imageUrl }} />
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity onPress={launchMyImageLibrary}>
            <Image
              style={styles.image}
              source={require('./assets/noimage.png')}
            />
          </TouchableOpacity>
        );
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scrollView}>
          <View style={styles.body}>
            <Text style={styles.cloudImageText}>
              Pick Images and Save it in the Cloud
            </Text>
            <View style={styles.ImageSections}>{getImage()}</View>
            <View>
              <Text style={styles.infoText}>Filename: {filename}</Text>
              <Text style={styles.infoText}>cloudDirURL: {cloudDirURL}</Text>
              <Text style={styles.infoText}>fileLocation: {fileLocation}</Text>
              {/* <Text style={styles.infoText}>imageUrl: {imageUrl}</Text> */}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  body: {
    backgroundColor: 'white',
    justifyContent: 'center',
    width: Dimensions.get('screen').width,
  },
  cloudImageText: { textAlign: 'center', fontSize: 20, paddingBottom: 10 },
  ImageSections: {
    display: 'flex',
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  image: {
    width: 150,
    height: 150,
    borderColor: 'black',
    borderWidth: 1,
    marginHorizontal: 3,
  },
  btnParentSection: {
    alignItems: 'center',
    marginTop: 10,
  },
  btnSection: {
    width: 225,
    height: 50,
    backgroundColor: '#DCDCDC',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    marginBottom: 10,
  },
  btnText: {
    textAlign: 'center',
    color: 'gray',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoText: {
    fontWeight: 'bold',
    padding: 4,
  },
});

export default App;
