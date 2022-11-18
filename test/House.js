const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("House", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function houseContract() {
    const House = await hre.ethers.getContractFactory("House");
    const house = await House.deploy();

    const [owner] = await ethers.getSigners();

    await house.connect(owner).functions.initialFund({
      value: ethers.utils.parseEther('12')
    });

    return { house, owner };
  }

  describe("Deployment - should already gave run initialFund()", function () {
    it("Should Deploy contract", async function () {
      const { house, owner } = await loadFixture(houseContract);

      // console.log("starting fund", await house.functions.startingFund())

      const provider = ethers.provider;
      // console.log("inital deployed bal", await provider.getBalance(house.address))

      expect(await house.owner()).to.equal(await owner.getAddress());

      //expect contract balance to be 12 eth since it's initially funded
      expect(parseInt(await provider.getBalance(house.address))).to.equal(12000000000000000000);
    });
  });
  describe("Player interaction", async function () {
    it("Player should be able to pay ante", async function () {
      const { house, owner } = await loadFixture(
        houseContract
      );

      const [_, player1, player2] = await ethers.getSigners();
      const provider = ethers.provider;

      // get ante from contract
      const ante = await house.ante();
      expect(ethers.utils.formatEther(ante)).to.equal('0.00025');

      // player1 ready to play and pay ante
      const houseConnectPlayer1 = house.connect(player1);
      const readyTx = await houseConnectPlayer1.functions.playerReadyPayAnte({
        value: ante
      });

      let receipt = await readyTx.wait();

      // test event emitting
      expect(receipt.events[0].event).to.equal("PlayerReady") // expect correct event name
      expect(receipt.events[0].args.player).to.equal(await player1.getAddress()) // expect ready player to be the one that paid ante
      expect(receipt.events[0].args.playerReady).to.be.true; // expect ready to be true
      
      // contract balance should increase by ante amount in wei
      expect(parseInt(await ethers.provider.getBalance(house.address))).to.equal(
        12000250000000000000
      );


      // get the player's struct regarding the ante just paid
      const player1Game = await houseConnectPlayer1.functions.s_user_guesses(await player1.getAddress(), 0)
      expect(player1Game.paidAnte).to.be.true;
      expect(player1Game.guess).to.be.equal(0);
      expect(player1Game.numberToMatch).to.be.equal(0);
      expect(player1Game.win).to.be.equal(false);
      expect(player1Game.gameFinished).to.be.equal(false);

      await expect(houseConnectPlayer1.functions.playerReadyPayAnte({
        value: ante
      })).to.be.revertedWith(
        'Ante already paid.'
      );

    });


    it("Player1 - game1 lose should be able submit guess and contract will emit the results", async function () {
      let tx, receipt;


      const { house, owner } = await loadFixture(
        houseContract
      );

      const [_, player1, player2] = await ethers.getSigners();
      const provider = ethers.provider;

      // console.log(parseInt(await house.ante()));
      const ante = await house.ante();

      // player1 ready to play and pay ante
      const houseConnectPlayer1 = house.connect(player1);
      tx = await houseConnectPlayer1.functions.playerReadyPayAnte({
        value: ante
      });

      receipt = await tx.wait();
      expect(receipt.events[0].args.playerReady).to.be.true; // expect ready to be true

      const player1Guess = 3;
      const currRound = 1;
      tx = await houseConnectPlayer1.functions.submitGuess(player1Guess, 1);

      receipt = await tx.wait();

      // test event emitting
      expect(receipt.events[0].event).to.equal("WinningNumberGenerated")
      expect(receipt.events[0].args.generatedNumber).to.equal(5)
      expect(receipt.events[1].event).to.equal("GuessSubmitted") // expect correct event name
      expect(receipt.events[1].args.player).to.equal(await player1.getAddress()) // expect ready player to be the one that paid ante
      expect(receipt.events[1].args.guess).to.equal(player1Guess); // expect ready to be true
      expect(receipt.events[2].event).to.equal("GameFinished") // expect correct event name
      expect(receipt.events[2].args.win).to.equal(false) // expect ready player to be the one that paid ante
      expect(receipt.events[2].args.numberToMatch).to.equal(2); // expect ready to be true
      expect(receipt.events[2].args.updatedWinnings).to.equal(ante); // expect ready to be true
      
      // test player's game struct is updated with player's guess and a number to match was generated
      const currentGame = await houseConnectPlayer1.functions.s_user_guesses(await player1.getAddress(), 0)
      expect(currentGame.paidAnte).to.be.true;
      expect(currentGame.guess).to.be.equal(player1Guess);
      expect(currentGame.numberToMatch).to.be.equal(2);
      expect(currentGame.win).to.be.equal(false);
      expect(currentGame.gameFinished).to.be.equal(true); // game is processed and ended
      
      // after losing, currentGame.gameFinished should be updated to true
      // through an event, we should update the FE to notify player and then redirect to player page
    });

    it("Player1 - game1: win, game2: lose", async function () {
      const generatedNumber = 2; // the "random" number that is the winning number
      let tx, receipt;


      const { house, owner } = await loadFixture(
        houseContract
      );

      const [_, player1, player2] = await ethers.getSigners();
      const provider = ethers.provider;

      // console.log(parseInt(await house.ante()));
      const ante = await house.ante();

      // player1 ready to play and pay ante
      const houseConnectPlayer1 = house.connect(player1);
      tx = await houseConnectPlayer1.functions.playerReadyPayAnte({
        value: ante
      });

      receipt = await tx.wait();
      expect(receipt.events[0].args.playerReady).to.be.true; // expect ready to be true


      console.log("before submitting: ", await provider.getBalance(await player1.getAddress()))

      // win the first round
      const roundOneGuess = 2;
      const roundOne = 1;

      // test event emitting
      await expect(houseConnectPlayer1.functions.submitGuess(roundOneGuess, roundOne))
          .to.emit(house, "WinningNumberGenerated")
          .withArgs(5); // We accept any value as `when` arg
                
      await expect(houseConnectPlayer1.functions.submitGuess(roundOneGuess, roundOne))
          .to.emit(house, "GuessSubmitted")
          .withArgs(await player1.getAddress(), roundOneGuess); // We accept any value as `when` arg

      await expect(houseConnectPlayer1.functions.submitGuess(roundOneGuess, roundOne))
          .to.emit(house, "RoundFinished")
          .withArgs(true, generatedNumber, ante); // We accept any value as `when` arg
  
          
      // test player's game struct is updated with player's guess and a number to match was generated
      const firstRound = await houseConnectPlayer1.functions.s_user_guesses(await player1.getAddress(), 0)
      expect(firstRound.paidAnte).to.be.true;
      expect(firstRound.guess).to.be.equal(roundOneGuess);
      expect(firstRound.numberToMatch).to.be.equal(2);
      expect(firstRound.win).to.be.equal(true);
      expect(firstRound.gameFinished).to.be.equal(false); // game is processed and ended

      console.log("after submitting - 1: ", await provider.getBalance(await player1.getAddress()))
      // lose the second round
      const roundTwoGuess = 3
      const roundTwo = 2

      // test event emitting
      await expect(houseConnectPlayer1.functions.submitGuess(roundTwoGuess, roundTwo))
          .to.emit(house, "Sent")
          // .withArgs(house.address, await player1.getAddress(), 500000000000000); // We accept any value as `when` arg
          .withArgs(house.address, await player1.getAddress(), ante); // We accept any value as `when` arg
      // await expect(houseConnectPlayer1.functions.submitGuess(roundTwoGuess, roundTwo))
      //     .to.emit(house, "GameFinished")
      //     .withArgs(false, 5, 25); // We accept any value as `when` arg
  
          
      // test player's game struct is updated with player's guess and a number to match was generated
      const secondRound = await houseConnectPlayer1.functions.s_user_guesses(await player1.getAddress(), 0)
      expect(secondRound.guess).to.be.equal(roundTwoGuess);
      expect(secondRound.win).to.be.equal(false);
      expect(secondRound.gameFinished).to.be.equal(true); 
      expect(secondRound.winnings).to.be.equal(ante); 
      
      console.log("after submitting - 2: ", await provider.getBalance(await player1.getAddress()))

      // after losing, currentGame.gameFinished should be updated to true
      // through an event, we should update the FE to notify player and then redirect to player page
    });

  })

  //   it("Should fail if the unlockTime is not in the future", async function () {
  //     // We don't use the fixture here because we want a different deployment
  //     const latestTime = await time.latest();
  //     const Lock = await ethers.getContractFactory("Lock");
  //     await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith(
  //       "Unlock time should be in the future"
  //     );
  //   });
  // });

  // describe("Withdrawals", function () {
  //   describe("Validations", function () {
  //     it("Should revert with the right error if called too soon", async function () {
  //       const { lock } = await loadFixture(deployOneYearLockFixture);

  //       await expect(lock.withdraw()).to.be.revertedWith(
  //         "You can't withdraw yet"
  //       );
  //     });

  //     it("Should revert with the right error if called from another account", async function () {
  //       const { lock, unlockTime, otherAccount } = await loadFixture(
  //         deployOneYearLockFixture
  //       );

  //       // We can increase the time in Hardhat Network
  //       await time.increaseTo(unlockTime);

  //       // We use lock.connect() to send a transaction from another account
  //       await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
  //         "You aren't the owner"
  //       );
  //     });

  //     it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
  //       const { lock, unlockTime } = await loadFixture(
  //         deployOneYearLockFixture
  //       );

  //       // Transactions are sent using the first signer by default
  //       await time.increaseTo(unlockTime);

  //       await expect(lock.withdraw()).not.to.be.reverted;
  //     });
  //   });

  //   describe("Events", function () {
  //     it("Should emit an event on withdrawals", async function () {
  //       const { lock, unlockTime, lockedAmount } = await loadFixture(
  //         deployOneYearLockFixture
  //       );

  //       await time.increaseTo(unlockTime);

  //       await expect(lock.withdraw())
  //         .to.emit(lock, "Withdrawal")
  //         .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
  //     });
  //   });

  //   describe("Transfers", function () {
  //     it("Should transfer the funds to the owner", async function () {
  //       const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
  //         deployOneYearLockFixture
  //       );

  //       await time.increaseTo(unlockTime);

  //       await expect(lock.withdraw()).to.changeEtherBalances(
  //         [owner, lock],
  //         [lockedAmount, -lockedAmount]
  //       );
  //     });
  //   });
});
