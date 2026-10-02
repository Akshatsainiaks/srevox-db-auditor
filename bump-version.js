const fs = require("fs");
const path = require("path");

const newVersion = process.argv[2];
if (!newVersion) {
  console.error("Usage: node bump-version.js <new-version> (e.g. 0.1.1)");
  process.exit(1);
}

const cleanVersion = newVersion.replace(/^v/, "");
if (!/^\d+\.\d+\.\d+/.test(cleanVersion)) {
  console.error(`Error: "${newVersion}" is not a valid semver version.`);
  process.exit(1);
}

// Determine root directory whether run from root or scripts/
const ROOT_DIR = fs.existsSync(path.join(__dirname, "apps"))
  ? __dirname
  : path.resolve(__dirname, "..");

const packages = [
  "apps/frontend/package.json",
  "apps/api/package.json"
];

let updatedCount = 0;

for (const pkgRelativePath of packages) {
  const absolutePath = path.join(ROOT_DIR, pkgRelativePath);
  if (!fs.existsSync(absolutePath)) {
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

// Bump Rust Cargo.toml package versions
const cargoPaths = [
  "apps/activity-service/Cargo.toml",
  "apps/db-audit-processor/Cargo.toml"
];

for (const cargoRelPath of cargoPaths) {
  const cargoPath = path.join(ROOT_DIR, cargoRelPath);
  if (fs.existsSync(cargoPath)) {
    try {
      let cargoContent = fs.readFileSync(cargoPath, "utf8");
      cargoContent = cargoContent.replace(/^(version\s*=\s*")\d+\.\d+\.\d+(")/m, `$1${cleanVersion}$2`);
      fs.writeFileSync(cargoPath, cargoContent, "utf8");
      console.log(`✅ Updated ${cargoRelPath} to version ${cleanVersion}`);
      updatedCount++;
    } catch (err) {
      console.error(`❌ Failed to update ${cargoRelPath}:`, err.message || err);
    }
  }
}

// Bump Helm Chart.yaml (version and appVersion)
const helmChartPath = path.join(ROOT_DIR, "charts/srevox-db-auditor/Chart.yaml");
if (fs.existsSync(helmChartPath)) {
  try {
    let chartContent = fs.readFileSync(helmChartPath, "utf8");
    chartContent = chartContent.replace(/^(version:\s*)\d+\.\d+\.\d+/m, `$1${cleanVersion}`);
    chartContent = chartContent.replace(/^(appVersion:\s*)\d+\.\d+\.\d+/m, `$1${cleanVersion}`);
    fs.writeFileSync(helmChartPath, chartContent, "utf8");
    console.log(`✅ Updated charts/srevox-db-auditor/Chart.yaml to version ${cleanVersion}`);
    updatedCount++;
  } catch (err) {
    console.error(`❌ Failed to update charts/srevox-db-auditor/Chart.yaml:`, err.message || err);
  }
}

// Bump Helm values.yaml image tags
const helmValuesPath = path.join(ROOT_DIR, "charts/srevox-db-auditor/values.yaml");
if (fs.existsSync(helmValuesPath)) {
  try {
    let valuesContent = fs.readFileSync(helmValuesPath, "utf8");
    valuesContent = valuesContent.replace(/(tag:\s*)\d+\.\d+\.\d+/g, `$1${cleanVersion}`);
    valuesContent = valuesContent.replace(/(:\d+\.\d+\.\d+)/g, `:${cleanVersion}`);
    fs.writeFileSync(helmValuesPath, valuesContent, "utf8");
    console.log(`✅ Updated charts/srevox-db-auditor/values.yaml image tags to version ${cleanVersion}`);
    updatedCount++;
  } catch (err) {
    console.error(`❌ Failed to update charts/srevox-db-auditor/values.yaml:`, err.message || err);
  }
}

// Bump Helm index.yaml
const helmIndexPath = path.join(ROOT_DIR, "charts/index.yaml");
if (fs.existsSync(helmIndexPath)) {
  try {
    let indexContent = fs.readFileSync(helmIndexPath, "utf8");
    indexContent = indexContent.replace(/(version:\s*)\d+\.\d+\.\d+/g, `$1${cleanVersion}`);
    indexContent = indexContent.replace(/(appVersion:\s*)\d+\.\d+\.\d+/g, `$1${cleanVersion}`);
    indexContent = indexContent.replace(/srevox-db-auditor-\d+\.\d+\.\d+\.tgz/g, `srevox-db-auditor-${cleanVersion}.tgz`);
    fs.writeFileSync(helmIndexPath, indexContent, "utf8");
    console.log(`✅ Updated charts/index.yaml to version ${cleanVersion}`);
    updatedCount++;
  } catch (err) {
    console.error(`❌ Failed to update charts/index.yaml:`, err.message || err);
  }
}

// Bump docker-compose.yml image tags
const dcPath = path.join(ROOT_DIR, "docker-compose.yml");
if (fs.existsSync(dcPath)) {
  try {
    let dcContent = fs.readFileSync(dcPath, "utf8");
    dcContent = dcContent.replace(/(akshatsaini08\/srevox-db-auditor-[a-z-]+:)(v?\d+\.\d+\.\d+|latest)/g, `$1v${cleanVersion}`);
    fs.writeFileSync(dcPath, dcContent, "utf8");
    console.log(`✅ Updated docker-compose.yml image tags to v${cleanVersion}`);
    updatedCount++;
  } catch (err) {
    console.error(`❌ Failed to update ${dcPath}:`, err.message || err);
  }
}

// Package Helm chart tgz archive
const { execSync } = require("child_process");
try {
  process.env.COPYFILE_DISABLE = "1";
  try {
    execSync("find charts/srevox-db-auditor -name '._*' -delete; find charts/srevox-db-auditor -name '.DS_Store' -delete", { cwd: ROOT_DIR });
  } catch {}

  const tgzFile = `charts/srevox-db-auditor-${cleanVersion}.tgz`;
  execSync(`tar --exclude='._*' --exclude='.DS_Store' -czvf ${tgzFile} -C charts srevox-db-auditor`, { 
    cwd: ROOT_DIR,
    env: { ...process.env, COPYFILE_DISABLE: "1" }
  });
  console.log(`✅ Packaged clean Helm chart archive ${tgzFile}`);
} catch (err) {
  console.warn(`Warning: Helm packaging notice:`, err.message || err);
}

if (updatedCount > 0) {
  console.log("\n🎉 Version bump successful!");
  console.log("Run the following commands to commit, tag, and publish your new release:");
  console.log(`  git add .`);
  console.log(`  git commit -m "chore(release): bump version to v${cleanVersion}"`);
  console.log(`  git tag v${cleanVersion}`);
  console.log(`  git push origin main --tags`);
}
