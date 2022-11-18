npx hardhat node --hostname 0.0.0.0 &
sleep 10
npx hardhat run scripts/deploy_game.js --network localhost
while true; do sleep 1; done

