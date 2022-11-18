// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  const provider = ethers.provider;

  const [owner] = await ethers.getSigners();

  const House = await hre.ethers.getContractFactory("House");
  const house = await House.deploy();

  await house.deployed();

  console.log(
    `House deployed to ${house.address}`
  );

  await house.connect(owner).functions.initialFund({
    value: ethers.utils.parseEther('12')
  });

  console.log("inital deployed bal", await provider.getBalance(house.address))

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
