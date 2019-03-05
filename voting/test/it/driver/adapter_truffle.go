package driver

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

func AdapterForTruffleGanache(config *Config) EthereumAdapter {
	return &truffleAdapter{
		debug:       config.DebugLogs,
		projectPath: ".",
		network:     "ganache",
		startBlock:  0,
	}
}

func AdapterForTruffleRopsten(config *Config) EthereumAdapter {
	return &truffleAdapter{
		debug:       config.DebugLogs,
		projectPath: ".",
		network:     "ropsten",
		startBlock:  400000,
	}
}

type truffleAdapter struct {
	debug       bool
	projectPath string
	network     string
	startBlock  int
}

func (ta *truffleAdapter) GetStartOfHistoryBlock() int {
	return ta.startBlock
}

func (ta *truffleAdapter) GetCurrentBlock() int {
	bytesOutput := ta.run("exec ./truffle-scripts/getCurrentBlock.js")
	out := struct {
		CurrentBlock int
	}{}
	err := json.Unmarshal(bytesOutput, &out)
	if err != nil {
		panic(err.Error() + "\n" + string(bytesOutput))
	}
	return out.CurrentBlock
}

func (ta *truffleAdapter) DeployERC20Contract() (ethereumErc20Address string) {
	bytes := ta.run("exec ./truffle-scripts/deployERC20.js")
	out := struct {
		Address string
	}{}
	err := json.Unmarshal(bytes, &out)
	if err != nil {
		panic(err.Error() + "\n" + string(bytes))
	}
	return out.Address
}

func (ta *truffleAdapter) GetStakes(ethereumErc20Address string, numberOfStakes int) []int {
	bytes := ta.run("exec ./truffle-scripts/getStakes.js",
		"ERC20_CONTRACT_ADDRESS="+ethereumErc20Address,
		"NUMBER_OF_STAKEHOLDERS_ETHEREUM="+fmt.Sprintf("%d", numberOfStakes),
	)
	out := struct {
		Balances []string
	}{}
	err := json.Unmarshal(bytes, &out)
	if err != nil {
		panic(err.Error() + "\n" + string(bytes))
	}
	response := make([]int, len(out.Balances))
	for i, v := range out.Balances {
		n, _ := strconv.ParseUint(v, 16, 32)
		response[i] = fromEthereumToken(n)
	}
	return response
}

func (ta *truffleAdapter) SetStakes(ethereumErc20Address string, stakes []int) {
	ethStakes := make([]uint64, len(stakes))
	for i, v := range stakes {
		ethStakes[i] = toEthereumToken(v) + 10*STAKE_TOKEN_DELEGATE_VALUE
	}
	out, _ := json.Marshal(ethStakes)

	ta.run("exec ./truffle-scripts/fundStakes.js",
		"ERC20_CONTRACT_ADDRESS="+ethereumErc20Address,
		"ACCOUNT_STAKES_ON_ETHEREUM="+string(out),
	)
}

func (ta *truffleAdapter) Transfer(ethereumErc20Address string, from int, to int, amount int) {
	var tokens uint64
	if amount == 0 {
		tokens = STAKE_TOKEN_DELEGATE_VALUE
	} else {
		tokens = toEthereumToken(amount)
	}
	ta.run("exec ./truffle-scripts/transfer.js",
		"ERC20_CONTRACT_ADDRESS="+ethereumErc20Address,
		"FROM_ACCOUNT_INDEX_ON_ETHEREUM="+fmt.Sprintf("%d", from),
		"TO_ACCOUNT_INDEX_ON_ETHEREUM="+fmt.Sprintf("%d", to),
		"TRANSFER_AMOUNT="+fmt.Sprintf("%d", tokens),
	)
}

func (ta *truffleAdapter) DeployValidatorsContract() (ethereumValidatorsAddress string) {
	bytes := ta.run("exec ./truffle-scripts/deployValidators.js")
	out := struct {
		Address string
	}{}
	err := json.Unmarshal(bytes, &out)
	if err != nil {
		panic(err.Error() + "\n" + string(bytes))
	}
	return out.Address
}

func (ta *truffleAdapter) GetValidators(ethereumValidatorsAddress string) []string {
	bytes := ta.run("exec ./truffle-scripts/getValidators.js",
		"VALIDATORS_CONTRACT_ADDRESS="+ethereumValidatorsAddress,
	)
	out := struct {
		Validators []string
	}{}
	err := json.Unmarshal(bytes, &out)
	if err != nil {
		panic(err.Error() + "\n" + string(bytes))
	}
	return out.Validators
}

func (ta *truffleAdapter) SetValidators(ethereumValidatorsAddress string, validators []int) {
	out, _ := json.Marshal(validators)
	ta.run("exec ./truffle-scripts/setValidators.js",
		"VALIDATORS_CONTRACT_ADDRESS="+ethereumValidatorsAddress,
		"VALIDATOR_ACCOUNT_INDEXES_ON_ETHEREUM="+string(out),
	)
}

func (ta *truffleAdapter) DeployVotingContract() (ethereumVotingAddress string) {
	bytes := ta.run("exec ./truffle-scripts/deployVoting.js")
	out := struct {
		Address string
	}{}
	err := json.Unmarshal(bytes, &out)
	if err != nil {
		panic(err.Error() + "\n" + string(bytes))
	}
	return out.Address
}

func (ta *truffleAdapter) Delegate(ethereumVotingAddress string, from int, to int) {
	ta.run("exec ./truffle-scripts/delegate.js",
		"VOTING_CONTRACT_ADDRESS="+ethereumVotingAddress,
		"FROM_ACCOUNT_INDEX_ON_ETHEREUM="+fmt.Sprintf("%d", from),
		"TO_ACCOUNT_INDEX_ON_ETHEREUM="+fmt.Sprintf("%d", to),
	)
}

func (ta *truffleAdapter) Vote(ethereumVotingAddress string, activistIndex int, candidates [3]int) {
	out, _ := json.Marshal(candidates)
	ta.run("exec ./truffle-scripts/vote.js",
		"VOTING_CONTRACT_ADDRESS="+ethereumVotingAddress,
		"ACTIVIST_ACCOUNT_INDEX_ON_ETHEREUM="+fmt.Sprintf("%d", activistIndex),
		"CANDIDATE_ACCOUNT_INDEXES_ON_ETHEREUM="+string(out),
	)
}

func (ta *truffleAdapter) GetBalance(ethereumErc20Address string, userAccountOnEthereum string) (userBalanceOnEthereum int) {
	bytes := ta.run("exec ./truffle-scripts/getBalance.js",
		"ERC20_CONTRACT_ADDRESS="+ethereumErc20Address,
		"USER_ACCOUNT_ON_ETHEREUM="+userAccountOnEthereum,
	)
	out := struct {
		Balance string
	}{}
	err := json.Unmarshal(bytes, &out)
	if err != nil {
		panic(err.Error() + "\n" + string(bytes))
	}
	n, _ := strconv.ParseUint(out.Balance, 16, 32)
	return fromEthereumToken(n)
}

func (ta *truffleAdapter) GetBalanceByIndex(ethereumErc20Address string, userAccountIndexOnEthereum int) (userBalanceOnEthereum int) {
	bytes := ta.run("exec ./truffle-scripts/getBalanceByIndex.js",
		"ERC20_CONTRACT_ADDRESS="+ethereumErc20Address,
		"USER_ACCOUNT_INDEX_ON_ETHEREUM="+fmt.Sprintf("%d", userAccountIndexOnEthereum),
	)
	out := struct {
		Balance string
	}{}
	err := json.Unmarshal(bytes, &out)
	if err != nil {
		panic(err.Error() + "\n" + string(bytes))
	}
	n, _ := strconv.ParseUint(out.Balance, 16, 32)
	return fromEthereumToken(n)
}

func (ta *truffleAdapter) run(args string, env ...string) []byte {
	args += " --network " + ta.network
	if ta.debug {
		fmt.Println("\n  ### RUNNING: truffle " + args)
		if len(env) > 0 {
			fmt.Printf("      ENV: %+v\n", env)
		}
		fmt.Printf("\n  ### OUTPUT:\n\n")
	}
	argsArr := strings.Split(args, " ")
	cmd := exec.Command("./node_modules/.bin/truffle", argsArr...)
	cmd.Dir = ta.projectPath
	cmd.Env = append(os.Environ(), env...)
	var out []byte
	var err error
	if ta.debug {
		out, err = combinedOutputWithStdoutPipe(cmd)
	} else {
		out, err = cmd.CombinedOutput()
	}
	if err != nil {
		panic(err.Error() + "\n" + string(out))
	}
	// remove first line of output (Using network...)
	index := bytes.IndexRune(out, '\n')
	return out[index:]
}