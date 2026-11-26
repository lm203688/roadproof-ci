/**
 * Injects targets/appintents/*.swift into the main app target so the App Intents
 * land in the main bundle's Metadata.appintents and show up in Spotlight / Siri.
 */
const fs = require('fs');
const path = require('path');
const { withXcodeProject, withDangerousMod } = require('expo/config-plugins');

const SRC_SUBDIR = path.join('targets', 'appintents');
const DST_DIR_NAME = 'AppIntents';

function copySources(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const srcDir = path.join(root, SRC_SUBDIR);
      if (!fs.existsSync(srcDir)) {
        console.warn('[withAppIntents] no targets/appintents dir, skipping');
        return cfg;
      }
      const iosDir = path.join(root, 'ios');
      const dstDir = path.join(iosDir, DST_DIR_NAME);
      fs.mkdirSync(dstDir, { recursive: true });
      const swift = fs.readdirSync(srcDir).filter((f) => f.endsWith('.swift'));
      if (!swift.length) throw new Error('[withAppIntents] targets/appintents has no .swift file');
      for (const f of swift) fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
      console.log(`[withAppIntents] copied ${swift.length} swift file(s)`);
      return cfg;
    },
  ]);
}

module.exports = function withAppIntents(config) {
  config = copySources(config);
  return withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;
    const appTarget = proj.getFirstTarget();
    const dstDir = path.join(cfg.modRequest.projectRoot, 'ios', DST_DIR_NAME);
    if (!fs.existsSync(dstDir)) return cfg;

    const files = fs.readdirSync(dstDir).filter((f) => f.endsWith('.swift'));
    if (proj.pbxGroupByName(DST_DIR_NAME)) return cfg;

    const relPaths = files.map((f) => `${DST_DIR_NAME}/${f}`);
    const group = proj.addPbxGroup(relPaths, DST_DIR_NAME, DST_DIR_NAME);
    const mainGroup = proj.getFirstProject().firstProject.mainGroup;
    proj.addToPbxGroup(group.uuid, mainGroup);
    for (const rel of relPaths) {
      const abs = path.join(dstDir, path.basename(rel));
      proj.addSourceFile(abs, { target: appTarget.uuid }, group.uuid);
    }
    console.log(`[withAppIntents] injected ${files.length} file(s) into main target`);
    return cfg;
  });
};
