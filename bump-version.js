const fs = require("fs");
const path = require("path");

const newVersion = process.argv[2];
if (!newVersion) {
  console.error("Usage: node bump-version.js <new-version> (e.g. 0.1.7)");
  process.exit(1);
}

const cleanVersion = newVersion.replace(/^v/, "");
if (!/^\d+\.\d+\.\d+/.test(cleanVersion)) {
  console.error(`Error: "${newVersion}" is not a valid semver version.`);
  process.exit(1);
}

const packages = [
  "apps/frontend/package.json",
  "apps/api/package.json",
  "apps/alert-worker/package.json"
];

let updatedCount = 0;

for (const pkgRelativePath of packages) {
  const absolutePath = path.join(__dirname, pkgRelativePath);
  if (!fs.existsSync(absolutePath)) {
    console.warn(`Warning: File not found at ${pkgRelativePath}, skipping.`);
    continue;
  }

  try {
    const fileContent = fs.readFileSync(absolutePath, "utf8");
    const json = JSON.parse(fileContent);
    json.version = cleanVersion;
    
    fs.writeFileSync(absolutePath, JSON.stringify(json, null, 2) + "\n", "utf8");
    console.log(`✅ Updated ${pkgRelativePath} to version ${cleanVersion}`);
    updatedCount++;
  } catch (err) {
    console.error(`❌ Failed to update ${pkgRelativePath}:`, err.message || err);
  }
}

// Bump Rust Cargo.toml package version
const cargoPath = path.join(__dirname, "apps/activity-service/Cargo.toml");
if (fs.existsSync(cargoPath)) {
  try {
    let cargoContent = fs.readFileSync(cargoPath, "utf8");
    cargoContent = cargoContent.replace(/^(version\s*=\s*")\d+\.\d+\.\d+(")/m, `$1${cleanVersion}$2`);
    fs.writeFileSync(cargoPath, cargoContent, "utf8");
    console.log(`✅ Updated apps/activity-service/Cargo.toml to version ${cleanVersion}`);
    updatedCount++;
  } catch (err) {
    console.error(`❌ Failed to update Cargo.toml:`, err.message || err);
  }
}

// Bump Helm Chart.yaml (version and appVersion)
const helmChartPath = path.join(__dirname, "charts/srevox/Chart.yaml");
if (fs.existsSync(helmChartPath)) {
  try {
    let chartContent = fs.readFileSync(helmChartPath, "utf8");
    chartContent = chartContent.replace(/^(version:\s*)\d+\.\d+\.\d+/m, `$1${cleanVersion}`);
    chartContent = chartContent.replace(/^(appVersion:\s*)\d+\.\d+\.\d+/m, `$1${cleanVersion}`);
    fs.writeFileSync(helmChartPath, chartContent, "utf8");
    console.log(`✅ Updated charts/srevox/Chart.yaml to version ${cleanVersion}`);
    updatedCount++;
  } catch (err) {
    console.error(`❌ Failed to update charts/srevox/Chart.yaml:`, err.message || err);
  }
}

// Bump Helm values.yaml image tags
const helmValuesPath = path.join(__dirname, "charts/srevox/values.yaml");
if (fs.existsSync(helmValuesPath)) {
  try {
    let valuesContent = fs.readFileSync(helmValuesPath, "utf8");
    valuesContent = valuesContent.replace(/(tag:\s*)\d+\.\d+\.\d+/g, `$1${cleanVersion}`);
    valuesContent = valuesContent.replace(/(:\d+\.\d+\.\d+)/g, `:${cleanVersion}`);
    fs.writeFileSync(helmValuesPath, valuesContent, "utf8");
    console.log(`✅ Updated charts/srevox/values.yaml image tags to version ${cleanVersion}`);
    updatedCount++;
  } catch (err) {
    console.error(`❌ Failed to update charts/srevox/values.yaml:`, err.message || err);
  }
}

// Bump Helm index.yaml
const helmIndexPath = path.join(__dirname, "charts/index.yaml");
if (fs.existsSync(helmIndexPath)) {
  try {
    let indexContent = fs.readFileSync(helmIndexPath, "utf8");
    indexContent = indexContent.replace(/(version:\s*)\d+\.\d+\.\d+/g, `$1${cleanVersion}`);
    indexContent = indexContent.replace(/(appVersion:\s*)\d+\.\d+\.\d+/g, `$1${cleanVersion}`);
    indexContent = indexContent.replace(/srevox-\d+\.\d+\.\d+\.tgz/g, `srevox-${cleanVersion}.tgz`);
    fs.writeFileSync(helmIndexPath, indexContent, "utf8");
    console.log(`✅ Updated charts/index.yaml to version ${cleanVersion}`);
    updatedCount++;
  } catch (err) {
    console.error(`❌ Failed to update charts/index.yaml:`, err.message || err);
  }
}

// Bump docker-compose.yml image tags in both main srevox repo and srevox-setup
const dockerComposePaths = [
  path.join(__dirname, "docker-compose.yml"),
  path.join(__dirname, "../srevox-setup/docker-compose.yml")
];

for (const dcPath of dockerComposePaths) {
  if (fs.existsSync(dcPath)) {
    try {
      let dcContent = fs.readFileSync(dcPath, "utf8");
      // Reliably replaces :v0.1.x, :0.1.x, or :latest with :v<cleanVersion>
      dcContent = dcContent.replace(/(akshatsaini08\/srevox-[a-z-]+:)(v?\d+\.\d+\.\d+|latest)/g, `$1v${cleanVersion}`);
      fs.writeFileSync(dcPath, dcContent, "utf8");
      const relativePath = path.relative(__dirname, dcPath);
      console.log(`✅ Updated ${relativePath} image tags to v${cleanVersion}`);
      updatedCount++;
    } catch (err) {
      console.error(`❌ Failed to update ${dcPath}:`, err.message || err);
    }
  }
}

// Package Helm chart tgz archive & Sync to srevox-setup
const { execSync } = require("child_process");
try {
  // Disable macOS AppleDouble ._* metadata generation and clean dot files
  process.env.COPYFILE_DISABLE = "1";
  try {
    execSync("find charts/srevox -name '._*' -delete; find charts/srevox -name '.DS_Store' -delete", { cwd: __dirname });
  } catch {}

  const tgzFile = `charts/srevox-${cleanVersion}.tgz`;
  execSync(`tar --exclude='._*' --exclude='.DS_Store' -czvf ${tgzFile} -C charts srevox`, { 
    cwd: __dirname,
    env: { ...process.env, COPYFILE_DISABLE: "1" }
  });
  console.log(`✅ Packaged clean Helm chart archive ${tgzFile}`);

  const setupChartsDir = path.join(__dirname, "../srevox-setup/charts");
  if (fs.existsSync(setupChartsDir)) {
    execSync(`cp -r charts/srevox ${setupChartsDir}/ && cp ${tgzFile} ${setupChartsDir}/ && cp charts/index.yaml ${setupChartsDir}/`, { cwd: __dirname });
    console.log(`✅ Synced clean Helm chart & index.yaml to srevox-setup/charts`);
  }
} catch (err) {
  console.warn(`Warning: Helm packaging/sync notice:`, err.message || err);
}

if (updatedCount > 0) {
  console.log("\n🎉 Version bump successful!");
  console.log("Run the following commands to commit, tag, and publish your new release:");
  console.log(`  git add .`);
  console.log(`  git commit -m "chore(release): bump version to v${cleanVersion}"`);
  console.log(`  git tag v${cleanVersion}`);
  console.log(`  git push origin main --tags`);
}
