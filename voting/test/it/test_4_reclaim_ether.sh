#!/usr/bin/env bash
# Copyright 2019 the orbs-ethereum-contracts authors
# This file is part of the orbs-ethereum-contracts library in the Orbs project.
#
# This source code is licensed under the MIT license found in the LICENSE file in the root directory of this source tree.
# The above notice should be included in all copies or substantial portions of the software.


go test . -run TestReclaimGuardianDeposits -v -count 1 -timeout 0 $@

