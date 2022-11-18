pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract House is Ownable {
    uint public ante; // solidity defaults to wei
    // address public gameMaster;
    uint private startingFund = 0;
    uint8[5]public multiplier;

    event AntePaid(address from, uint amount);
    event Sent(address from, address to, uint amount);
    event withDrawEth(address indexed to, uint indexed amount);
    event PlayerReady(address indexed player, bool indexed playerReady);
    event GuessSubmitted(address indexed player, uint indexed guess);
    event WinningNumberGenerated(uint generatedNumber);
    event RoundFinished(bool indexed win, uint indexed numberToMatch, uint indexed updatedWinnings);
    event GameFinished(bool indexed win, uint indexed numberToMatch, uint indexed updatedWinnings);

    struct PlayerGuess {
        address player;
        bool paidAnte;
        uint guess;
        uint numberToMatch;
        bool win;
        bool gameFinished;
        uint winnings;
    }

    mapping(address => uint) public playerBalances;
    mapping(address => bool) public s_paid_ante;
    mapping(address => PlayerGuess[]) public s_user_guesses;
    mapping(address => uint) public anteAmount;

    constructor() {
        setAnte();
        setMultiplier();
    }

    // set default ante using function overloading
    function setAnte() internal onlyOwner {
        ante = 250000000000000; // 0.0002 eth
    }

    // 200000000000000 wei == 0.0002 eth
    function setAnte(uint ante_amount) external onlyOwner {
        ante = ante_amount;
    }

    function setMultiplier() internal onlyOwner {
        multiplier = [1,2,3,4,5];
    }

    function setMultiplier(uint8 roundOne, uint8 roundTwo, uint8 roundThree, uint8 roundFour, uint8 roundFive) external onlyOwner {
        require(roundOne < roundTwo, "Multipliers for lower rounds must be less than higher rounds.");
        require(roundTwo < roundThree, "Multipliers for lower rounds must be less than higher rounds.");
        require(roundThree < roundFour, "Multipliers for lower rounds must be less than higher rounds.");
        require(roundFour < roundFive, "Multipliers for lower rounds must be less than higher rounds.");
    
        multiplier = [roundOne, roundTwo, roundThree, roundFour, roundFive];
    }

    function initialFund() external payable onlyOwner {
        // require(msg.sender == owner, "Only the owner can deposit initial funds.");
        require(startingFund == 0, "Alrady has initial initial funds.");

        startingFund = msg.value;
    }

    function submitGuess(uint _guess, uint _currRound) external {
        PlayerGuess storage user = getCurrentGame();
        user.guess = _guess;

        // get random number
        uint randNum = getRandomNumber();
        // update struct
        user.numberToMatch = randNum;
        // check for win
        bool win = checkForMatchingGuess(user.guess, user.numberToMatch);
        // update struct with true/false for win
        user.win = win;

        // emit that a guess was submitted
        emit GuessSubmitted(msg.sender, _guess);

        // process and finalize the game
        processResults(win, _currRound, user);
    }

    function getRandomNumber() internal returns (uint randNum) {
        uint matchingNumber = 5;

        emit WinningNumberGenerated(matchingNumber);

        return 2;
    }

    function checkForMatchingGuess(uint _playerGuess, uint _randNum)
        internal
        pure
        returns (bool win)
    {
        return _playerGuess == _randNum;
    }

    function processResults(bool _win, uint _currRound, PlayerGuess storage currGame) internal returns (bool payPlayer) {
        require(currGame.gameFinished == false, "Game is already over.");

        if (_win == true) {
            // notify player:game won, matching number and amount won
            uint updatedWinnings = currGame.winnings * multiplier[_currRound-1];
            currGame.winnings = updatedWinnings;
            emit RoundFinished(true, currGame.numberToMatch, updatedWinnings);
        } else {
            // notify player: lost game, guess, number
            // currGame.winnings = 0;
            currGame.gameFinished = true;
            emit GameFinished(false, currGame.numberToMatch, currGame.winnings);
        }

        console.log("winnings before paying: ", currGame.winnings);
        payWinnings(payable(msg.sender), currGame.winnings);
        
        // flip paid ante to false to play next game
        s_paid_ante[msg.sender] = false;
        
        return _win;
    }

    function playerReadyPayAnte() external payable {
        require(msg.value == ante, "Doesn't match required ante cost.");
        require(s_paid_ante[msg.sender] == false, "Ante already paid.");

        // create user struct once ante is paid and player has not already paid ante
        PlayerGuess memory user = PlayerGuess(
            msg.sender,
            true,
            0,
            0, // 0 for numberToMatch means randon number has not been generated yet
            false,
            false,
            ante
        );

        // save to list of games per user
        s_user_guesses[msg.sender].push(user);

        // update mapping to record that player has paid ante
        s_paid_ante[msg.sender] = true;

        anteAmount[msg.sender] = msg.value;

        emit PlayerReady(msg.sender, true);
    }

    function getCurrentGame() internal view returns (PlayerGuess storage game) {
        // struct PlayerGuess {
        //     address player;
        //     bool paidAnte;
        //     uint guess;
        //     uint numberToMatch;
        //     bool win;
        //     bool gameFinished;
        // }
        uint last_element = s_user_guesses[msg.sender].length - 1;
        PlayerGuess storage user = s_user_guesses[msg.sender][last_element];
        return user;
    }

    function gameBalance() public view returns (uint) {
        return address(this).balance;
    }

    // function transferToPlayer(address payable _player, uint256 _amount)
    function payWinnings(address payable _player, uint256 _amount)
        private
        // onlyOwner
    {
        require(this.gameBalance() >= _amount, "Game has no ETH to payout.");
        // require(playerBalances[_player] > 0, "Player has no balance.");
        require(_amount > 0, "Player has no winnings to pay out.");

        playerBalances[_player] = 0;

        _sendViaCall(_player, _amount);
    }

    function _sendViaCall(address payable _to, uint _amount) private {
        // Call returns a boolean value indicating success or failure.
        // This is the current recommended method to use.
        (bool sent, bytes memory data) = _to.call{value: _amount}("");
        require(sent, "Failed to send Ether");

        emit Sent(address(this), _to, _amount);
    }

    function withdrawEth() external onlyOwner {
        emit withDrawEth(msg.sender, this.gameBalance());
    }
}
