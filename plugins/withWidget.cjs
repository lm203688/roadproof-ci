/**
 * 自建 WidgetKit 扩展 target（RoadProof 版，移植自 PartFit 已验证模板）。
 *
 * 1. targets/widget/*.swift 复制进 ios/RoadProofWidget/，写扩展 Info.plist 与 entitlements
 * 2. pbxproj 里新建 app_extension target，Copy Files(PlugIns) 嵌进主 App（addTarget 已建）
 * 3. 主 App 与扩展共享 group.<bundleId>，Widget 读同一份快照
 */
const fs = require('fs');
const path = require('path');
const { withXcodeProject, withDangerousMod } = require('expo/config-plugins');

const TARGET_NAME = 'RoadProofWidget';

function identifiers(config) {
  const appBundle =
    (config.ios && config.ios.bundleIdentifier) ||
    process.env.ROADPROOF_BUNDLE_ID ||
    'com.lixing.roadproof';
  const widgetBundle = process.env.ROADPROOF_WIDGET_BUNDLE_ID || `${appBundle}.widget`;
  const appGroup = process.env.ROADPROOF_APP_GROUP || `group.${appBundle}`;
  const teamId = process.env.ROADPROOF_TEAM_ID || (config.ios && config.ios.appleTeamId) || '';
  return { appBundle, widgetBundle, appGroup, teamId };
}

const entitlementsXml = (appGroup) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${appGroup}</string>
  </array>
</dict>
</plist>
`;

const WIDGET_INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>EV status</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>
`;

function copySources(config, appGroup) {
  const noGroup = process.env.ROADPROOF_NO_APP_GROUP === '1';
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const srcDir = path.join(root, 'targets', 'widget');
      const iosDir = path.join(root, 'ios');
      const dstDir = path.join(iosDir, TARGET_NAME);
      fs.mkdirSync(dstDir, { recursive: true });
      for (const f of fs.readdirSync(srcDir)) {
        if (f.endsWith('.swift')) fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
      }
      fs.writeFileSync(path.join(dstDir, `${TARGET_NAME}-Info.plist`), WIDGET_INFO_PLIST);
      // Without a registered App Group on the portal, writing the entitlement makes
      // export fail with a profile mismatch. The flag builds a compile-checkable
      // app; the widget then shows its empty state instead of the last verdict.
      if (!noGroup) {
        const entitlements = entitlementsXml(appGroup);
        fs.writeFileSync(path.join(dstDir, `${TARGET_NAME}.entitlements`), entitlements);
        const appName = cfg.modRequest.projectName || 'RoadProof';
        const appDir = path.join(iosDir, appName);
        if (fs.existsSync(appDir)) {
          fs.writeFileSync(path.join(appDir, `${appName}.entitlements`), entitlements);
        }
      } else {
        console.warn('[withWidget] ROADPROOF_NO_APP_GROUP=1 -> no App Group entitlements');
      }
      return cfg;
    },
  ]);
}

function eachBuildSetting(proj, targetUuid, fn) {
  const targets = proj.pbxNativeTargetSection();
  const listId = targets[targetUuid].buildConfigurationList;
  const list = proj.pbxXCConfigurationList()[listId];
  const configs = proj.pbxXCBuildConfigurationSection();
  for (const c of (list.buildConfigurations || []).map((x) => x.value)) {
    if (configs[c] && configs[c].buildSettings) fn(configs[c].buildSettings, configs[c].name);
  }
}

module.exports = function withWidget(config) {
  const appName = config.name || 'RoadProof';
  const marketingVersion = config.version || '1.0.0';
  const buildNumber = (config.ios && config.ios.buildNumber) || '1';
  const ids = identifiers(config);
  const profileMain = process.env.ROADPROOF_PROFILE_MAIN || '';
  const profileWidget = process.env.ROADPROOF_PROFILE_WIDGET || '';
  config = copySources(config, ids.appGroup);

  return withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;
    if (proj.pbxTargetByName(TARGET_NAME)) return cfg;

    const appTarget = proj.getFirstTarget();
    const created = proj.addTarget(TARGET_NAME, 'app_extension', TARGET_NAME, ids.widgetBundle);
    const targetUuid = created.uuid;

    const dstDir = path.join(cfg.modRequest.projectRoot, 'ios', TARGET_NAME);
    const swiftFiles = fs
      .readdirSync(dstDir)
      .filter((f) => f.endsWith('.swift'))
      .map((f) => `${TARGET_NAME}/${f}`);
    proj.addBuildPhase(swiftFiles, 'PBXSourcesBuildPhase', 'Sources', targetUuid);

    const widgets = fs.readdirSync(dstDir).filter((f) => f.endsWith('.swift'));
    if (widgets.length !== 1) {
      console.warn(`[withWidget] expected 1 swift file, got ${widgets.join(', ')}`);
    }

    const noGroup = process.env.ROADPROOF_NO_APP_GROUP === '1';
    eachBuildSetting(proj, targetUuid, (bs) => {
      Object.assign(bs, {
        ...(noGroup ? {} : { CODE_SIGN_ENTITLEMENTS: `"${TARGET_NAME}/${TARGET_NAME}.entitlements"` }),
        CURRENT_PROJECT_VERSION: `"${buildNumber}"`,
        GENERATE_INFOPLIST_FILE: 'NO',
        INFOPLIST_FILE: `"${TARGET_NAME}/${TARGET_NAME}-Info.plist"`,
        IPHONEOS_DEPLOYMENT_TARGET: '"17.0"',
        MARKETING_VERSION: `"${marketingVersion}"`,
        PRODUCT_BUNDLE_IDENTIFIER: `"${ids.widgetBundle}"`,
        SWIFT_VERSION: '"5.0"',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        LD_RUNPATH_SEARCH_PATHS:
          '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
      });
      if (ids.teamId) bs.DEVELOPMENT_TEAM = `"${ids.teamId}"`;
      if (profileWidget) {
        Object.assign(bs, {
          CODE_SIGN_STYLE: 'Manual',
          CODE_SIGN_IDENTITY: '"Apple Distribution"',
          PROVISIONING_PROFILE_SPECIFIER: `"${profileWidget}"`,
        });
      }
    });

    eachBuildSetting(proj, appTarget.uuid, (bs) => {
      if (!noGroup) bs.CODE_SIGN_ENTITLEMENTS = `"${appName}/${appName}.entitlements"`;
      if (profileMain) {
        Object.assign(bs, {
          CODE_SIGN_STYLE: 'Manual',
          CODE_SIGN_IDENTITY: '"Apple Distribution"',
          PROVISIONING_PROFILE_SPECIFIER: `"${profileMain}"`,
        });
      }
    });

    return cfg;
  });
};
