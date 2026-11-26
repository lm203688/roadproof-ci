/**
 * withUIScene — Expo config plugin that makes an Expo/React Native app adopt the
 * UIScene life cycle. iOS 26/27 SDK kills legacy didFinishLaunching windows at launch.
 */
const { withInfoPlist, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SCENE_DELEGATE_SWIFT = `

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    let appDelegate = UIApplication.shared.delegate as? AppDelegate
    let sceneWindow = UIWindow(windowScene: windowScene)
    sceneWindow.backgroundColor = UIColor.white
    if let root = appDelegate?.window?.rootViewController {
      sceneWindow.rootViewController = root
    }
    self.window = sceneWindow
    appDelegate?.window = sceneWindow
    sceneWindow.makeKeyAndVisible()
  }
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneDelegate(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const projectName = cfg.modRequest.projectName;
      const appDelegate = path.join(projectRoot, projectName, 'AppDelegate.swift');
      if (fs.existsSync(appDelegate)) {
        const src = fs.readFileSync(appDelegate, 'utf8');
        if (!src.includes('class SceneDelegate')) {
          fs.writeFileSync(appDelegate, src + SCENE_DELEGATE_SWIFT);
        }
      }
      return cfg;
    },
  ]);
}

module.exports = function withUIScene(config) {
  config = withSceneManifest(config);
  config = withSceneDelegate(config);
  return config;
};
