/**
 * Copyright 2019 the orbs-ethereum-contracts authors
 * This file is part of the orbs-ethereum-contracts library in the Orbs project.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root directory of this source tree.
 * The above notice should be included in all copies or substantial portions of the software.
 */

const express = require('express');

const rewardsRouter = (apiService) => {
  const router = express.Router();

  /**
   * @swagger
   *
   * /rewards/history/{address}:
   *  get:
   *    description: Returns the rewards history of the given address
   *    tags:
   *      - Rewards
   *    parameters:
   *      - name: address
   *        in: path
   *        description: Ethereum address
   *        required: true
   *    responses:
   *      '200':
   *        description: The detailed information about the rewards history for given address
   */
  router.get('/rewards/history/:address', async (req, res) => {
    const address = req.params['address'];
    const rewardsHistory = await apiService.getRewardsHistory(address);

    res.json(rewardsHistory);
  });

  /**
   * @swagger
   *
   * /rewards/{address}:
   *  get:
   *    description: Returns the information about rewards of all types for given address
   *    tags:
   *      - Rewards
   *    parameters:
   *      - name: address
   *        in: path
   *        description: Ethereum address
   *        required: true
   *    responses:
   *      '200':
   *        description: The detailed information about rewards of all types for given address
   */
  router.get('/rewards/:address', async (req, res) => {
    const address = req.params['address'];
    const result = await apiService.getRewards(address);
    res.json(result);
  });

  return router;
};

module.exports = rewardsRouter;
