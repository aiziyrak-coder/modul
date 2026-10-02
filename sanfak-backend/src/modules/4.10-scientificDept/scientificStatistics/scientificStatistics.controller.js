"use strict";

const winston = require("#shared/winston.logger");

const Article = require("#modules/4.10-scientificDept/article/article.model");
const Thesis = require("#modules/4.10-scientificDept/thesis/thesis.model");
const Methodical = require("#modules/4.10-scientificDept/methodicalRecommendation/methodicalRecommendation.model");
const Monograph = require("#modules/4.10-scientificDept/monograph/monograph.model");
const ScientificDegree = require("#modules/4.10-scientificDept/scientificDegree/scientificDegree.model");
const ScientificTitle = require("#modules/4.10-scientificDept/scientificTitle/scientificTitle.model");
const QualifyingApplicant = require("#modules/4.10-scientificDept/qualifyingApplicant/qualifyingApplicant.model");
const Patent = require("#modules/4.10-scientificDept/patent/patent.model");

const LIVE = { active: true };

module.exports = {
  overview: async (req, res, next) => {
    try {
      const [
        articlesTotal,
        articlesApproved,
        thesesTotal,
        methodicalTotal,
        monographsTotal,
        degreesTotal,
        titlesTotal,
        patentsTotal,
        qualifyingTotal,
        qualifyingPassed,
      ] = await Promise.all([
        Article.countDocuments(LIVE),
        Article.countDocuments({ ...LIVE, status: "approved" }),
        Thesis.countDocuments(LIVE),
        Methodical.countDocuments(LIVE),
        Monograph.countDocuments(LIVE),
        ScientificDegree.countDocuments(LIVE),
        ScientificTitle.countDocuments(LIVE),
        Patent.countDocuments(LIVE),
        QualifyingApplicant.countDocuments(LIVE),
        QualifyingApplicant.countDocuments({ ...LIVE, status: "passed" }),
      ]);

      return res.status(200).json({
        articles: { total: articlesTotal, approved: articlesApproved },
        theses: { total: thesesTotal },
        methodical: { total: methodicalTotal },
        monographs: { total: monographsTotal },
        degrees: { total: degreesTotal },
        titles: { total: titlesTotal },
        patents: { total: patentsTotal },
        qualifying: { total: qualifyingTotal, passed: qualifyingPassed },
      });
    } catch (error) {
      winston.error(error.message);
      return next(error);
    }
  },
};
