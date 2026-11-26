/**
 * withPodTargetFloor — raises IPHONEOS_DEPLOYMENT_TARGET on every CocoaPods target.
 *
 * Why: Xcode 27 SDK refuses anything below 15.0, and a pod's resource-bundle target
 * (e.g. RNCAsyncStorage_resources) keeps the podspec floor (13.4) even when
 * expo-build-properties raises the pod targets themselves.
 *
 * It edits the generated Podfile in place inside the existing post_install block,
 * so expo's own post_install work is preserved.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const FLOOR = '15.5';
const MARK = 'post_install do |installer|';
const SNIPPET = `${MARK}
  # ROADPROOF_TARGET_FLOOR: resource-bundle targets inherit stale podspec floors
  installer.pods_project.targets.each do |t|
    t.build_configurations.each do |c|
      c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${FLOOR}'
    end
  end
`;

module.exports = function withPodTargetFloor(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfile)) {
        console.warn('[withPodTargetFloor] no Podfile yet, skipping');
        return cfg;
      }
      let src = fs.readFileSync(podfile, 'utf8');
      if (src.includes('ROADPROOF_TARGET_FLOOR')) return cfg;
      if (!src.includes(MARK)) {
        console.warn('[withPodTargetFloor] post_install block not found');
        return cfg;
      }
      src = src.replace(MARK, SNIPPET);
      fs.writeFileSync(podfile, src);
      console.log(`[withPodTargetFloor] pod targets floored at ${FLOOR}`);
      return cfg;
    },
  ]);
};
