const AcademicYearModel = require("#references/academicYear/academicYear.model");
const DepartmentModel = require("#references/department/department.model");
const DirectionModel = require("#references/direction/direction.model");
const AcademicLevelModel = require("#references/academicLevel/academicLevel.model");
const ReadingFormModel = require("#references/readingForm/readingForm.model");
const EducationFormModel = require("#references/educationForm/educationForm.model");
const StudyPeriodModel = require("#references/studyPeriod/studyPeriod.model");
const SpecializationModel = require("#references/specialization/specialization.model");
const LanguageOfInstructionModel = require("#references/languageOfInstruction/languageOfInstruction.model");
const GroupModel = require("#references/group/group.model");
const ScienceModel = require("#references/science/science.model");
const PositionModel = require("#references/position/position.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const {
  ON_HOURS_PER_STUDENT,
  YAN_HOURS_PER_STUDENT,
  MISSED_HOURS_PER_STUDENT,
} = require("#modules/4.02-studyLoad/workload/workload.model");

const LECTURE_HOUR = 40;
const PRACTICAL_HOUR = 30;
const LABORATORY_HOUR = 20;
const ANNUAL_HOURS_NORMA = 100;

const GROUPS = Object.freeze([
  { title: "101-guruh", lang: "uz", studentNumber: 20 },
  { title: "102-guruh", lang: "uz", studentNumber: 22 },
  { title: "103-guruh", lang: "uz", studentNumber: 18 },
  { title: "104-guruh (rus)", lang: "ru", studentNumber: 15 },
]);
const GROUP_COUNT = GROUPS.length;
const STREAM_COUNT = new Set(GROUPS.map((g) => g.lang)).size;
const STUDENT_COUNT = GROUPS.reduce((sum, g) => sum + g.studentNumber, 0);

const PLAN_AUDITORIUM_HOUR = LECTURE_HOUR + PRACTICAL_HOUR + LABORATORY_HOUR;
const TEACHING_AUDITORIUM_HOUR =
  LECTURE_HOUR * STREAM_COUNT + PRACTICAL_HOUR * GROUP_COUNT + LABORATORY_HOUR * GROUP_COUNT;

const ON_HOURS = Math.round(STUDENT_COUNT * ON_HOURS_PER_STUDENT);
const YAN_HOURS = Math.round(STUDENT_COUNT * YAN_HOURS_PER_STUDENT);
const QOLDIRILGAN_HOURS = Math.round(STUDENT_COUNT * MISSED_HOURS_PER_STUDENT);
const AUTO_ITEMS_HOUR = ON_HOURS + YAN_HOURS + QOLDIRILGAN_HOURS;

const TOTAL_HOUR = TEACHING_AUDITORIUM_HOUR + AUTO_ITEMS_HOUR;
const TOTAL_POSITIONS = Math.floor(TOTAL_HOUR / ANNUAL_HOURS_NORMA);
const HOURLY = TOTAL_HOUR - TOTAL_POSITIONS * ANNUAL_HOURS_NORMA;

const EXPECTED = {
  lecture: LECTURE_HOUR,
  practical: PRACTICAL_HOUR,
  laboratory: LABORATORY_HOUR,
  streamCount: STREAM_COUNT,
  groupCount: GROUP_COUNT,
  studentCount: STUDENT_COUNT,
  onHours: ON_HOURS,
  yanHours: YAN_HOURS,
  qoldirilganHours: QOLDIRILGAN_HOURS,
  autoItemsHour: AUTO_ITEMS_HOUR,
  planAuditoriumHour: PLAN_AUDITORIUM_HOUR,
  teachingAuditoriumHour: TEACHING_AUDITORIUM_HOUR,
  totalHour: TOTAL_HOUR,
  annualHoursNorma: ANNUAL_HOURS_NORMA,
  totalPositions: TOTAL_POSITIONS,
  hourly: HOURLY,
};

async function buildWorkloadFixture() {
  const academicYear = await AcademicYearModel.create({ title: "2024/2025" });
  const department = await DepartmentModel.create({
    title: "Ichki kasalliklar propedevtikasi kafedrasi",
  });

  const [langUz, langRu] = await Promise.all([
    LanguageOfInstructionModel.create({ title: "O'zbek" }),
    LanguageOfInstructionModel.create({ title: "Rus" }),
  ]);

  const direction = await DirectionModel.create({
    title: "Davolash ishi",
    teachingLanguages: [langUz._id, langRu._id],
  });

  const [academicLevel, readingForm, educationForm, studyPeriod, specialization] =
    await Promise.all([
      AcademicLevelModel.create({ title: "Bakalavr" }),
      ReadingFormModel.create({ title: "Kredit-modul" }),
      EducationFormModel.create({ title: "Kunduzgi" }),
      StudyPeriodModel.create({ title: "5 yil" }),
      SpecializationModel.create({ title: "Umumiy amaliyot" }),
    ]);

  const langByKey = { uz: langUz, ru: langRu };
  const groups = await Promise.all(
    GROUPS.map((g) =>
      GroupModel.create({
        title: g.title,
        lang: langByKey[g.lang]._id,
        studentNumber: g.studentNumber,
        active: true,
      }),
    ),
  );

  const workingSchedule = await WorkingScheduleModel.create({
    academicYear: academicYear._id,
    enrollmentYear: "2024",
    currentCourse: 1,
    direction: direction._id,
    academicLevel: academicLevel._id,
    readingForm: readingForm._id,
    educationForm: educationForm._id,
    studyPeriod: studyPeriod._id,
    specialization: specialization._id,
    year: "2024",
    groups: groups.map((g) => g._id),
    active: true,
  });

  const science = await ScienceModel.create({
    title: "Ichki kasalliklar propedevtikasi",
    department: department._id,
  });

  const workingPlan = await WorkingPlanModel.create({
    workingSchedule: workingSchedule._id,
    semesters: {
      1: {
        semester: "1",
        blocks: [
          {
            blockCode: "BLK1",
            title: "Majburiy fanlar",
            sciences: [
              {
                title: science.title,
                science: science._id,
                department: department._id,
                particle: [
                  {
                    canonical: "lecture",
                    slug: "maruza",
                    title: "Ma'ruza",
                    value: LECTURE_HOUR,
                  },
                  {
                    canonical: "practical",
                    slug: "amaliy",
                    title: "Amaliy mashg'ulot",
                    value: PRACTICAL_HOUR,
                  },
                  {
                    canonical: "laboratory",
                    slug: "laboratoriya",
                    title: "Laboratoriya mashg'uloti",
                    value: LABORATORY_HOUR,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });

  const position = await PositionModel.create({
    title: "Test lavozim (fixture)",
    annualHours: ANNUAL_HOURS_NORMA,
    active: true,
  });

  return {
    academicYear,
    department,
    direction,
    languages: { uz: langUz, ru: langRu },
    groups,
    workingSchedule,
    workingPlan,
    science,
    position,
    EXPECTED,
  };
}

module.exports = { buildWorkloadFixture, EXPECTED };
