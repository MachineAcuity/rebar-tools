//

const execSync = require("child_process").execSync;
const del = require("del");
const fs = require("fs");
const nodegit = require("nodegit");
const os = require("os");
const path = require("path");
const { promisify } = require("util");

const readFileAsync = promisify(fs.readFile);

function parseVersionString(versionAsString, digitsExpected) {
  const arrVersion = versionAsString.split(".");

  for (let ix = 0; ix < arrVersion.length; ix++)
    arrVersion[ix] = Number(arrVersion[ix]);

  if (
    arrVersion.length != digitsExpected ||
    isNaN(arrVersion[0]) ||
    isNaN(arrVersion[1]) ||
    isNaN(arrVersion[2]) ||
    (digitsExpected == 4 && isNaN(arrVersion[3]))
  )
    throw new Error(
      "💔  Version should have four numeric components. Instead found: " +
        versionAsString
    );

  return arrVersion;
}

async function getPackageJSVersion(cwd, applicationName) {
  const packageJSFileName = path.join(
    cwd,
    "/cut-version",
    applicationName,
    "/units/_configuration/package.js"
  );

  try {
    const packageJS = await readFileAsync(packageJSFileName, "utf8");
    const packageJSAfterVersion = packageJS.split("version = '")[1];
    const packageJSVersionString = packageJSAfterVersion.split("'")[0];

    return parseVersionString(packageJSVersionString, 4);
  } catch (ex) {
    console.log("💔  Failed to parse version in " + packageJSFileName);
    throw new Error(ex);
  }
}

async function getPackageJSONVersion(cwd, applicationName) {
  const packageJSONName = path.join(
    cwd,
    "cut-version/",
    applicationName,
    "package.json"
  );

  try {
    const packageJSONAsString = await readFileAsync(packageJSONName, "utf8");
    const packageJSONAsObject = JSON.parse(packageJSONAsString);

    return parseVersionString(packageJSONAsObject.version, 3);
  } catch (ex) {
    console.log("💔  Failed to parse version in " + packageJSONName);
    throw new Error(ex);
  }
}

async function bumpVersion(cwd, repository) {
  let arrPackageJSVersion = await getPackageJSVersion(cwd, repository);
  let arrPackageJSONVersion = await getPackageJSONVersion(cwd, repository);

  console.log(
    "🔥  Current version in package.js:   " + arrPackageJSVersion.join(".")
  );
  console.log(
    "🔥  Current version in package.json: " + arrPackageJSONVersion.join(".")
  );

  // Use package.json version for package.js (could have been updated - reset build number then)
  if (
    arrPackageJSVersion[0] != arrPackageJSONVersion[0] ||
    arrPackageJSVersion[1] != arrPackageJSONVersion[1] ||
    arrPackageJSVersion[2] != arrPackageJSONVersion[2]
  ) {
    arrPackageJSVersion[0] = arrPackageJSONVersion[0];
    arrPackageJSVersion[1] = arrPackageJSONVersion[1];
    arrPackageJSVersion[2] = arrPackageJSONVersion[2];
    arrPackageJSVersion[3] = 0;
  } else {
    // Increment build - build number is ever increasing
    arrPackageJSVersion[3] += 1;
  }

  // Write package.js
  const newPackageJSVersion = arrPackageJSVersion.join(".");

  await updateFile(
    "./cut-version/" + repository + "/units/_configuration/package.js",
    "export const version = ",
    "export const version = '" + newPackageJSVersion + "'"
  );

  // Report the new full version with build
  console.log("🔥  New version in package.js:       " + newPackageJSVersion);

  return arrPackageJSVersion;
}

async function updateFile(fileName, searchString, newContentOfLine) {
  let fileLines = (await readFileAsync(fileName, "utf8")).split("\n");
  let index = 0;

  let updated = false;
  while (index < fileLines.length) {
    if (fileLines[index].indexOf(searchString) > -1) {
      if (fileLines[index] == newContentOfLine)
        console.log("[" + fileName + "] is already up to date");
      else {
        fileLines[index] = newContentOfLine;
        fs.writeFileSync(fileName, fileLines.join("\n"));

        updated = true;
      }
      break;
    } else index++;
  }

  if (!updated) {
    throw new Error("💔  Could not update " + fileName);
  }
}

async function createReleaseBranch(cwd, applicationName, repositoryRevision) {
  const repository = await nodegit.Repository.open(
    "./cut-version/" + applicationName
  );
  const signature = repository.defaultSignature();

  const headRef = await repository.getReference("HEAD");
  const headCommit = await repository.getCommit(headRef.target());

  const releaseBranchName = "revision-" + repositoryRevision.join(".");
  const releaseBranch = await repository.createBranch(
    releaseBranchName,
    headCommit,
    1,
    signature,
    "Version cut " + repositoryRevision.join(".")
  );

  await repository.checkoutBranch(releaseBranch);

  const indexResult = await repository.refreshIndex();

  await indexResult.addAll();
  await indexResult.write();
  const oid = await indexResult.writeTree();

  const masterCommit = await repository.getMasterCommit();
  await repository.createCommit(
    "HEAD",
    signature,
    signature,
    "Version " + repositoryRevision.join("."),
    oid,
    [headCommit]
  );

  // Push to origin remote
  const repoPath = path.join(cwd, "cut-version", applicationName);
  const pushResults = execSync(
    "cd " + repoPath + " && git push origin " + releaseBranchName
  ).toString();
  console.log(pushResults);
}

async function ensureRepositoryIsOnDevelop(cwd, applicationName) {
  const repoPath = path.join(cwd, "cut-version", applicationName);

  const repository = await nodegit.Repository.open(repoPath);
  const currentBranch = await repository.getCurrentBranch();
  const currentBranchNameParts = currentBranch.name().split("/");
  const branchName = currentBranchNameParts[currentBranchNameParts.length - 1];

  if (branchName != "develop") {
    throw new Error(
      "💔  Cutting new versions should be done on develop, current branch is: " +
        branchName
    );
  }
}

function buildVersion(cwd, applicationName) {
  const repoPath = path.join(cwd, "cut-version", applicationName);

  console.log("🐢  Running yarn.");
  console.log(
    execSync(
      "cd " + repoPath + " && yarn && yarn setup-local-cut-version"
    ).toString()
  );

  console.log("🐢  Running build relay .... ");
  console.log(
    execSync(
      "cd " +
        repoPath +
        " && rm -rf deployment && mkdir deployment && npm run build-relay"
    ).toString()
  );

  console.log("🐢  Running build server .... ");
  console.log(
    execSync("cd " + repoPath + " && npm run build-server").toString()
  );

  console.log("🐢  Running build webpack .... ");
  console.log(
    execSync("cd " + repoPath + " && npm run build-webpack ").toString()
  );
}

// async function cloneRepositoryUsingNodeGit( applicationName, repositoryUrl ) {
//
//   const repositoryPath = path.join( process.cwd(), './cut-version/', applicationName )
//
//   // Remove any existing files
//   await delAsync( [repositoryPath] )
//
//   // Set callbacks for clone
//   const callbacks = {}
//
//   // OS X? Special callback for libgit2
//   if( os.type() === 'Darwin' ) {
//
//     // This is a required callback for OS X machines. There is a known issue
//     // with libgit2 being able to verify certificates from GitHub.
//     callbacks.certificateCheck = () => 1
//   }
//
//   callbacks.credentials = async( repoUrl, username ) => {
//
//     console.log( file++ )
//     console.log( username)
//     try {
//
//       const nodegitCred = await nodegit.Cred.sshKeyFromAgent(
//         username,
//         path.join( process.env.HOME, '.ssh/github_rsa.pub' ),
//         path.join( process.env.HOME, '.ssh/github_rsa' ),
//         ''
//       )
//       return nodegitCred
//
//     } catch( err ) {
//       console.error( err )
//     }
//   }
//
//   // Clone
//   await nodegit.Clone( repositoryUrl, repositoryPath, {
//     fetchOpts: { callbacks }
//   } )
// }

async function cloneRepository(cwd, applicationName, repositoryUrl) {
  const repositoryParentPath = path.join(cwd, "./cut-version/");
  const repositoryPath = path.join(repositoryParentPath, applicationName);

  // Remove any existing files
  await del([repositoryPath]);

  // Clone
  console.log("🐢  Cloning repository");
  const buildResults = execSync(
    "cd " +
      repositoryParentPath +
      " && git clone " +
      repositoryUrl +
      " " +
      repositoryPath +
      " && cd " +
      repositoryPath +
      " && git checkout develop && git pull origin develop"
  ).toString();
  console.log(buildResults);
}

module.exports.cutVersion = async (cwd, applicationName, repositoryUrl) => {
  // Get develop branch from github
  await cloneRepository(cwd, applicationName, repositoryUrl);

  // Verify that repo is on develop. If any poart of cloning failed, this will fail also
  await ensureRepositoryIsOnDevelop(cwd, applicationName);

  // Determine the version number and update
  const repositoryRevision = await bumpVersion(cwd, applicationName);

  // Build version
  buildVersion(cwd, applicationName);

  // Create release branch
  await createReleaseBranch(cwd, applicationName, repositoryRevision);

  // Print instructions
  const repositoryRevisionString = repositoryRevision.join(".");
  const branchName = "revision-" + repositoryRevisionString;
  console.log("🏆  Branch [" + branchName + "] has been created. Next steps:");
  console.log("💡  To test with gantry:\n");
  console.log("  ./update-" + applicationName + " " + repositoryRevisionString);
  console.log("\n");
  console.log("💡  To release after testing:\n");
  console.log(
    "  ./publish-" + applicationName + " " + repositoryRevisionString
  );
  console.log("\n");
};
