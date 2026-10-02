const router = require("express").Router();
const { proxyToMain } = require("#shared/proxy");

const ACCESS = "/qualification-access-test-results";
router.post(`${ACCESS}/start`, proxyToMain);
router.post(`${ACCESS}/select-option`, proxyToMain);
router.post(`${ACCESS}/finish`, proxyToMain);
router.get(`${ACCESS}/:course`, proxyToMain);

const FINAL = "/qualification-final-test-results";
router.post(`${FINAL}/start`, proxyToMain);
router.post(`${FINAL}/select-option`, proxyToMain);
router.post(`${FINAL}/finish`, proxyToMain);
router.get(`${FINAL}/:course/:topic`, proxyToMain);

const EXIT = "/qualification-exit-test-results";
router.get(`${EXIT}/my-courses`, proxyToMain);
router.get(`${EXIT}/my-certificates`, proxyToMain);
router.get(`${EXIT}/active`, proxyToMain);
router.post(`${EXIT}/start`, proxyToMain);
router.post(`${EXIT}/select-option`, proxyToMain);
router.post(`${EXIT}/finish`, proxyToMain);
router.get(`${EXIT}/:course`, proxyToMain);

const SURVEY = "/qualification-surveys";
router.get(`${SURVEY}/my`, proxyToMain);
router.post(`${SURVEY}/my/submit`, proxyToMain);

module.exports = router;
