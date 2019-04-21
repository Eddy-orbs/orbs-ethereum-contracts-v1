/**
 * Copyright 2019 the orbs-ethereum-contracts authors
 * This file is part of the orbs-ethereum-contracts library in the Orbs project.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root directory of this source tree.
 * The above notice should be included in all copies or substantial portions of the software.
 */

const express = require('express');

const delegationApiFactory = ethereumClient => {
  const router = express.Router();

  router.get('/delegation/status', async (req, res) => {
    try {
      const delegatedTo = await ethereumClient.getCurrentDelegation(req.query['address']);
      res.send(delegatedTo);
    } catch (err) {
      res.status(500).send(err.toString());
    }
  });

  return router;
};

module.exports = delegationApiFactory;