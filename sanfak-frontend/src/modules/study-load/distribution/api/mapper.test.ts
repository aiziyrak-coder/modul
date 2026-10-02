import { describe, expect, it } from 'vitest';
import {
  mapApprovalStep,
  mapTeacherOption,
  mapDistributionDetail,
  mapWorkloadBlocks,
  mapGroupOption,
  mapDistribution,
  mapElectiveOptions,
  DEFAULT_ALLOWED_STAKES,
  type BackendApprovalStep,
  type BackendDistributionDetail,
  type BackendWorkloadDetail,
} from './mapper';

describe('mapApprovalStep', () => {
  it('approvedBy obyekt bo\'lsa to\'liq ismni birlashtiradi (lastName firstName middleName)', () => {
    const backend: BackendApprovalStep = {
      step: 'kafedra',
      label: null,
      approvedBy: { _id: 'u1', firstName: 'Alisher', lastName: 'Karimov', middleName: 'Sobirovich' },
      status: 'approved',
      date: '2026-01-10T00:00:00.000Z',
      comment: null,
    };

    const result = mapApprovalStep(backend);

    expect(result.approverName).toBe('Karimov Alisher Sobirovich');
    expect(result.status).toBe('approved');
  });

  it('approvedBy string (populate qilinmagan id) bo\'lsa approverName null', () => {
    const backend: BackendApprovalStep = {
      step: 'prorektor',
      approvedBy: '65f0000000000000000000aa',
      status: 'pending',
    };

    const result = mapApprovalStep(backend);

    expect(result.approverName).toBeNull();
  });

  it('approvedBy null bo\'lsa approverName null', () => {
    const backend: BackendApprovalStep = { step: 'rektor', approvedBy: null, status: 'pending' };

    const result = mapApprovalStep(backend);

    expect(result.approverName).toBeNull();
  });

  it('label bo\'lmasa (backend til-neytral null) BO\'SH qoladi — slug sizib chiqmaydi', () => {
    const backend: BackendApprovalStep = { step: 'arm', label: null, status: 'pending' };

    const result = mapApprovalStep(backend);

    expect(result.label).toBe('');
  });

  it('label backenddan kelsa o\'shani ishlatadi', () => {
    const backend: BackendApprovalStep = { step: 'arm', label: 'ARM bo\'limi', status: 'pending' };

    const result = mapApprovalStep(backend);

    expect(result.label).toBe('ARM bo\'limi');
  });

  it('status yo\'q bo\'lsa "pending" fallback', () => {
    const backend: BackendApprovalStep = { step: 'kafedra' };

    const result = mapApprovalStep(backend);

    expect(result.status).toBe('pending');
  });

  it('rad etish sababi (comment) o\'tkaziladi', () => {
    const backend: BackendApprovalStep = {
      step: 'dean',
      status: 'rejected',
      comment: "Ma'lumotlar to'liq emas",
    };

    const result = mapApprovalStep(backend);

    expect(result.comment).toBe("Ma'lumotlar to'liq emas");
  });
});

describe('mapTeacherOption — /teachers seam', () => {
  const profile = {
    _id: 'profil-1',
    user: { _id: 'user-1', firstName: 'Dilnoza', lastName: 'Yusupova', middleName: null },
  };

  it('id sifatida USER id qaytaradi (profil id EMAS)', () => {
    const r = mapTeacherOption(profile);
    expect(r?.id).toBe('user-1');
    expect(r?.id).not.toBe('profil-1');
  });

  it("to'liq ismni `user` obyektidan oladi (lastName firstName)", () => {
    expect(mapTeacherOption(profile)?.fullName).toBe('Yusupova Dilnoza');
  });

  it('middleName bo\'lsa uni ham qo\'shadi', () => {
    const r = mapTeacherOption({
      _id: 'p2',
      user: { _id: 'u2', firstName: 'Alisher', lastName: 'Karimov', middleName: 'Sobirovich' },
    });
    expect(r?.fullName).toBe('Karimov Alisher Sobirovich');
  });

  it('ism bo\'sh bo\'lsa "Nomsiz" beradi, lekin id saqlanadi', () => {
    const r = mapTeacherOption({ _id: 'p3', user: { _id: 'u3' } });
    expect(r).toEqual({
      id: 'u3',
      fullName: 'Nomsiz',
      departmentId: null,
      departmentTitle: null,
      specialtyName: null,
      specialtyCode: null,
      academicDegree: null,
    });
  });

  it('`user` yo\'q profil null qaytaradi (ro\'yxatdan chiqariladi)', () => {
    expect(mapTeacherOption({ _id: 'p4' })).toBeNull();
    expect(mapTeacherOption({ _id: 'p5', user: null })).toBeNull();
  });
});

describe('mapDistributionDetail — department seam', () => {
  it('department.title dan departmentName ni o\'qiydi', () => {
    const backend: BackendDistributionDetail = {
      _id: 'd1',
      department: { _id: 'dep1', title: 'Ichki kasalliklar kafedrasi' },
    };

    const result = mapDistributionDetail(backend);

    expect(result.departmentName).toBe('Ichki kasalliklar kafedrasi');
  });

  it('title yo\'q, lekin name bo\'lsa — fallback sifatida ishlatadi', () => {
    const backend: BackendDistributionDetail = {
      _id: 'd2',
      department: { _id: 'dep2', name: 'Legacy nom' },
    };

    const result = mapDistributionDetail(backend);

    expect(result.departmentName).toBe('Legacy nom');
  });

  it('department null bo\'lsa departmentName null', () => {
    const backend: BackendDistributionDetail = { _id: 'd3', department: null };

    const result = mapDistributionDetail(backend);

    expect(result.departmentName).toBeNull();
  });
});

describe('mapWorkloadBlocks — yorliq va guruh filtri uchun maydonlar', () => {
  const backend: BackendWorkloadDetail = {
    _id: 'w1',
    academicYear: 'ay-2025',
    directions: [
      {
        direction: 'dir-davolash',
        blocks: [
          {
            _id: 'b1',
            science: { _id: 's1', title: 'Ovqatlanish gigiyenasi' },
            course: 1,
            studyWork: { semester: 1 },
            totalHour: 0,
          },
        ],
      },
      {
        direction: { _id: 'dir-profilaktika' },
        blocks: [
          {
            _id: 'b2',
            science: { _id: 's1', title: 'Ovqatlanish gigiyenasi' },
            course: 1,
            studyWork: { semester: 1 },
            totalHour: 120,
          },
        ],
      },
    ],
  };

  it('bir xil fan/kurs/semestr bo\'lsa ham bloklar totalHour bilan FARQLANADI', () => {
    const blocks = mapWorkloadBlocks(backend);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ scienceName: 'Ovqatlanish gigiyenasi', course: 1, semester: 1, totalHour: 0 });
    expect(blocks[1]).toMatchObject({ scienceName: 'Ovqatlanish gigiyenasi', course: 1, semester: 1, totalHour: 120 });
    expect(blocks[0]?.totalHour).not.toBe(blocks[1]?.totalHour);
  });

  it('directionId (xom string va populate obyekt) + hujjat academicYear olinadi', () => {
    const blocks = mapWorkloadBlocks(backend);

    expect(blocks[0]?.directionId).toBe('dir-davolash');
    expect(blocks[1]?.directionId).toBe('dir-profilaktika');
    expect(blocks[0]?.academicYearId).toBe('ay-2025');
    expect(blocks[1]?.academicYearId).toBe('ay-2025');
  });
});

describe('mapGroupOption — kontingent filtri maydonlari', () => {
  it('populate qilingan ref\'lardan id, kurs raqami va o\'quv yilini ajratadi', () => {
    const result = mapGroupOption({
      _id: 'g1',
      title: 'TP-101',
      direction: { _id: 'dir-profilaktika', title: 'Tibbiy profilaktika' },
      course: { _id: 'c1', title: '1-kurs' },
      academicYear: { _id: 'ay-2025', title: '2025/2026' },
    });

    expect(result).toEqual({
      id: 'g1',
      title: 'TP-101',
      directionId: 'dir-profilaktika',
      courseNumber: 1,
      academicYearId: 'ay-2025',
      studentNumber: null,
    });
  });

  it('ref\'lar yo\'q bo\'lsa null — filtr o\'sha mezon bo\'yicha qisilmaydi', () => {
    const result = mapGroupOption({ _id: 'g2', title: 'Eski guruh' });

    expect(result.directionId).toBeNull();
    expect(result.courseNumber).toBeNull();
    expect(result.academicYearId).toBeNull();
  });
});

describe('mapDistributionDetail — o\'qituvchi qabul/rad seam', () => {
  const withTeacher = (extra: Record<string, unknown>): BackendDistributionDetail => ({
    _id: 'd-acc',
    teachers: [
      {
        _id: 'entry-1',
        teacher: { _id: 'u1', firstName: 'Aziz', lastName: 'G\'ofurov' },
        ...extra,
      },
    ],
  } as BackendDistributionDetail);

  it('rad etilgan javobni sabab bilan o\'tkazadi', () => {
    const result = mapDistributionDetail(
      withTeacher({
        acceptanceStatus: 'rejected',
        rejectionReason: 'Dars yuklamasi ko\'p',
        respondedAt: '2026-08-13T10:00:00.000Z',
      }),
    );

    expect(result.teachers[0]?.acceptanceStatus).toBe('rejected');
    expect(result.teachers[0]?.rejectionReason).toBe('Dars yuklamasi ko\'p');
    expect(result.teachers[0]?.respondedAt).toBe('2026-08-13T10:00:00.000Z');
  });

  it('qabul qilingan javobni o\'tkazadi', () => {
    const result = mapDistributionDetail(withTeacher({ acceptanceStatus: 'accepted' }));

    expect(result.teachers[0]?.acceptanceStatus).toBe('accepted');
    expect(result.teachers[0]?.rejectionReason).toBeNull();
  });

  it('maydon YO\'Q bo\'lsa (eski hujjat) — "pending" fallback, qator buzilmaydi', () => {
    const result = mapDistributionDetail(withTeacher({}));

    expect(result.teachers[0]?.acceptanceStatus).toBe('pending');
    expect(result.teachers[0]?.rejectionReason).toBeNull();
    expect(result.teachers[0]?.respondedAt).toBeNull();
  });

  it('noma\'lum qiymat kelsa ham "pending" — UI kutilmagan enumdan himoyalangan', () => {
    const result = mapDistributionDetail(withTeacher({ acceptanceStatus: 'sent_back' }));

    expect(result.teachers[0]?.acceptanceStatus).toBe('pending');
  });
});

describe('mapDistributionDetail — teacher.id vs userId seam (2026-08-18 fix)', () => {
  it('`id` teacherEntry (`teachers[]._id`), `userId` esa `teacher._id` — ikkisi FARQLI', () => {
    const result = mapDistributionDetail({
      _id: 'd-uid',
      teachers: [
        {
          _id: 'entry-9',
          teacher: { _id: 'user-9', firstName: 'Aziz', lastName: "G'ofurov" },
        },
      ],
    } as BackendDistributionDetail);

    expect(result.teachers[0]?.id).toBe('entry-9');
    expect(result.teachers[0]?.userId).toBe('user-9');
    expect(result.teachers[0]?.id).not.toBe(result.teachers[0]?.userId);
  });

  it('vakant yozuvda (`teacher: null`) userId null, fullName "Vakant"', () => {
    const result = mapDistributionDetail({
      _id: 'd-uid-2',
      teachers: [{ _id: 'entry-vac', teacher: null, isVacant: true }],
    } as BackendDistributionDetail);

    expect(result.teachers[0]?.userId).toBeNull();
    expect(result.teachers[0]?.fullName).toBe('Vakant');
  });

  it('`teacher` maydoni umuman yo\'q bo\'lsa ham userId null (eski/buzuq yozuv)', () => {
    const result = mapDistributionDetail({
      _id: 'd-uid-3',
      teachers: [{ _id: 'entry-3' }],
    } as BackendDistributionDetail);

    expect(result.teachers[0]?.userId).toBeNull();
  });
});

describe('mapDistributionDetail — allowedStakes (ADR-006(b′))', () => {
  it('backend allowedStakes yuborsa — o\'shani ishlatadi', () => {
    const result = mapDistributionDetail({
      _id: 'd-stakes-1',
      allowedStakes: [0.5, 1],
    } as BackendDistributionDetail);

    expect(result.allowedStakes).toEqual([0.5, 1]);
  });

  it('allowedStakes YO\'Q bo\'lsa — DEFAULT ro\'yxatga qaytadi (bo\'sh dropdown TAQIQ)', () => {
    const result = mapDistributionDetail({ _id: 'd-stakes-2' } as BackendDistributionDetail);

    expect(result.allowedStakes).toEqual(DEFAULT_ALLOWED_STAKES);
  });

  it('allowedStakes BO\'SH massiv bo\'lsa ham — DEFAULT ro\'yxatga qaytadi', () => {
    const result = mapDistributionDetail({
      _id: 'd-stakes-3',
      allowedStakes: [],
    } as BackendDistributionDetail);

    expect(result.allowedStakes).toEqual(DEFAULT_ALLOWED_STAKES);
  });
});

describe('mapDistributionDetail — auditoriumHour (D-129)', () => {
  it('backend `auditoriumHour` yuborsa — o\'zgarishsiz o\'tadi', () => {
    const result = mapDistributionDetail({
      _id: 'd-aud-1',
      teachers: [
        {
          _id: 'entry-1',
          teacher: { _id: 'u1', firstName: 'Ali', lastName: 'Aliyev' },
          position: 'assistent',
          stavka: 1,
          totalHour: 460,
          auditoriumHour: 292,
          minHour: 400,
          maxHour: 600,
        },
      ],
    } as BackendDistributionDetail);

    expect(result.teachers[0]?.auditoriumHour).toBe(292);
    expect(result.teachers[0]?.totalHour).toBe(460);
  });

  it('VAKANT yozuvda ham auditoriumHour bor, minHour/maxHour esa null', () => {
    const result = mapDistributionDetail({
      _id: 'd-aud-2',
      teachers: [{ _id: 'entry-2', isVacant: true, totalHour: 150, auditoriumHour: 120 }],
    } as BackendDistributionDetail);

    expect(result.teachers[0]?.auditoriumHour).toBe(120);
    expect(result.teachers[0]?.minHour).toBeNull();
    expect(result.teachers[0]?.maxHour).toBeNull();
  });

  it('bloksiz yozuvda backend `0` yuboradi — `0` saqlanadi (null`ga aylanmaydi)', () => {
    const result = mapDistributionDetail({
      _id: 'd-aud-3',
      teachers: [{ _id: 'entry-3', totalHour: 0, auditoriumHour: 0, minHour: 400 }],
    } as BackendDistributionDetail);

    expect(result.teachers[0]?.auditoriumHour).toBe(0);
  });

  it('maydon YO\'Q (eski javob/kesh) — `null`, jimgina `0` EMAS', () => {
    const result = mapDistributionDetail({
      _id: 'd-aud-4',
      teachers: [{ _id: 'entry-4', totalHour: 460, minHour: 400 }],
    } as BackendDistributionDetail);

    expect(result.teachers[0]?.auditoriumHour).toBeNull();
  });
});

describe('mapTeacherOption — Faza 1/1b maydonlari (department, mutaxassislik)', () => {
  it('department populate qilingan obyekt bo\'lsa id+title ajratadi', () => {
    const r = mapTeacherOption({
      _id: 'profil-10',
      user: { _id: 'user-10', firstName: 'Olim', lastName: 'Rashidov' },
      department: { _id: 'dep-1', title: 'Ichki kasalliklar kafedrasi' },
      teachingSpecialtyName: 'Kardiologiya',
      teachingSpecialtyCode: '14.00.03',
      academicDegree: 'PhD',
    });

    expect(r?.departmentId).toBe('dep-1');
    expect(r?.departmentTitle).toBe('Ichki kasalliklar kafedrasi');
    expect(r?.specialtyName).toBe('Kardiologiya');
    expect(r?.specialtyCode).toBe('14.00.03');
    expect(r?.academicDegree).toBe('PhD');
  });

  it('department xom string (populate qilinmagan) bo\'lsa id saqlanadi, title null', () => {
    const r = mapTeacherOption({
      _id: 'profil-11',
      user: { _id: 'user-11', firstName: 'Kamola', lastName: 'Yusupova' },
      department: 'dep-2',
    });

    expect(r?.departmentId).toBe('dep-2');
    expect(r?.departmentTitle).toBeNull();
  });

  it('maydonlar yo\'q bo\'lsa (eski javob) — hammasi null (soxta ma\'lumot YO\'Q)', () => {
    const r = mapTeacherOption({
      _id: 'profil-12',
      user: { _id: 'user-12', firstName: 'Sardor', lastName: 'Aliyev' },
    });

    expect(r?.departmentId).toBeNull();
    expect(r?.departmentTitle).toBeNull();
    expect(r?.specialtyName).toBeNull();
    expect(r?.specialtyCode).toBeNull();
    expect(r?.academicDegree).toBeNull();
  });
});

describe('mapWorkloadBlocks — scienceDepartmentId (assign-drawer preview uchun)', () => {
  it('science.department populate qilingan obyekt bo\'lsa id ajratadi', () => {
    const blocks = mapWorkloadBlocks({
      _id: 'w2',
      directions: [
        {
          direction: 'dir-1',
          blocks: [
            {
              _id: 'b10',
              science: { _id: 's10', title: 'Kardiologiya', department: { _id: 'dep-1' } },
              course: 1,
              studyWork: { semester: 1 },
              totalHour: 60,
            },
          ],
        },
      ],
    });

    expect(blocks[0]?.scienceDepartmentId).toBe('dep-1');
  });

  it('science.department xom string bo\'lsa ham ajratadi', () => {
    const blocks = mapWorkloadBlocks({
      _id: 'w3',
      directions: [
        {
          blocks: [
            {
              _id: 'b11',
              science: { _id: 's11', title: 'Terapiya', department: 'dep-2' },
              totalHour: 0,
            },
          ],
        },
      ],
    });

    expect(blocks[0]?.scienceDepartmentId).toBe('dep-2');
  });

  it('science.department YO\'Q (eski javob, BE hali populate qilmagan) — null (⇒ FE preview unknown)', () => {
    const blocks = mapWorkloadBlocks({
      _id: 'w4',
      directions: [{ blocks: [{ _id: 'b12', science: { _id: 's12', title: 'Pediatriya' }, totalHour: 0 }] }],
    });

    expect(blocks[0]?.scienceDepartmentId).toBeNull();
  });
});

describe('mapDistributionDetail → blocks[].suitability (saqlangan belgi)', () => {
  const withBlock = (blockExtra: Record<string, unknown>): BackendDistributionDetail =>
    ({
      _id: 'd-suit',
      teachers: [
        {
          _id: 'entry-suit',
          teacher: { _id: 'u-suit', firstName: 'Nodir', lastName: 'Tosh' },
          blocks: [{ _id: 'blk-1', totalHour: 10, ...blockExtra }],
        },
      ],
    }) as BackendDistributionDetail;

  it('suitability.flag = "match" bo\'lsa o\'shani o\'tkazadi', () => {
    const result = mapDistributionDetail(withBlock({ suitability: { flag: 'match' } }));
    expect(result.teachers[0]?.blocks[0]?.suitability).toBe('match');
  });

  it('suitability.flag = "crossDepartment" bo\'lsa o\'shani o\'tkazadi', () => {
    const result = mapDistributionDetail(withBlock({ suitability: { flag: 'crossDepartment' } }));
    expect(result.teachers[0]?.blocks[0]?.suitability).toBe('crossDepartment');
  });

  it('suitability sub-hujjat YO\'Q (eski/feature\'dan oldingi blok) — "unknown" fallback, soxta qizil YO\'Q', () => {
    const result = mapDistributionDetail(withBlock({}));
    expect(result.teachers[0]?.blocks[0]?.suitability).toBe('unknown');
  });

  it('suitability.flag null bo\'lsa ham "unknown" fallback', () => {
    const result = mapDistributionDetail(withBlock({ suitability: { flag: null } }));
    expect(result.teachers[0]?.blocks[0]?.suitability).toBe('unknown');
  });
});

describe('mapDistributionDetail → blocks[].justification (Faza 2 bayonnoma)', () => {
  const withBlock = (blockExtra: Record<string, unknown>): BackendDistributionDetail =>
    ({
      _id: 'd-just',
      teachers: [
        {
          _id: 'entry-just',
          teacher: { _id: 'u-just', firstName: 'Nodir', lastName: 'Tosh' },
          blocks: [{ _id: 'blk-1', totalHour: 10, ...blockExtra }],
        },
      ],
    }) as BackendDistributionDetail;

  it('justification kalit UMUMAN yo\'q (eski blok, migratsiya yo\'q) — hamma-null obyekt, yiqilmaydi', () => {
    const result = mapDistributionDetail(withBlock({}));
    expect(result.teachers[0]?.blocks[0]?.justification).toEqual({
      basis: null,
      note: null,
      declaredBy: null,
      declaredAt: null,
    });
  });

  it('to\'liq justification (basis/note/declaredBy populate/declaredAt) — hammasi o\'tkaziladi', () => {
    const result = mapDistributionDetail(
      withBlock({
        justification: {
          basis: 'kafedrada_mutaxassis_yoq',
          note: "Kafedrada mos mutaxassis yo'q.",
          declaredBy: { _id: 'head-1', firstName: 'Aziz', lastName: 'Karimov' },
          declaredAt: '2026-08-27T10:00:00.000Z',
        },
      }),
    );
    expect(result.teachers[0]?.blocks[0]?.justification).toEqual({
      basis: 'kafedrada_mutaxassis_yoq',
      note: "Kafedrada mos mutaxassis yo'q.",
      declaredBy: 'Karimov Aziz',
      declaredAt: '2026-08-27T10:00:00.000Z',
    });
  });

  it('declaredBy populate qilinmagan (xom id string) — declaredBy null (ism yo\'q, id ko\'rsatilmaydi)', () => {
    const result = mapDistributionDetail(
      withBlock({ justification: { basis: 'boshqa', note: 'Izoh', declaredBy: 'head-1' } }),
    );
    expect(result.teachers[0]?.blocks[0]?.justification?.declaredBy).toBeNull();
  });

  it('barcha maydon null bo\'lsa ham (default holat) — hamma-null obyekt', () => {
    const result = mapDistributionDetail(
      withBlock({ justification: { basis: null, note: null, declaredBy: null, declaredAt: null } }),
    );
    expect(result.teachers[0]?.blocks[0]?.justification).toEqual({
      basis: null,
      note: null,
      declaredBy: null,
      declaredAt: null,
    });
  });
});

describe('mapElectiveOptions → suitability (Faza 2, §B.5)', () => {
  it('main va alternatives — har biri o\'z suitability qiymatini oladi', () => {
    const result = mapElectiveOptions({
      main: { science: 's-1', title: 'Anatomiya', suitability: 'match' },
      alternatives: [
        { science: 's-2', title: 'Gistologiya', selectable: true, suitability: 'crossDepartment' },
      ],
    });
    expect(result.main?.suitability).toBe('match');
    expect(result.alternatives[0]?.suitability).toBe('crossDepartment');
  });

  it('suitability maydoni YO\'Q (eski javob) — "unknown" fallback, soxta qizil YO\'Q', () => {
    const result = mapElectiveOptions({
      main: { science: 's-1', title: 'Anatomiya' },
      alternatives: [{ science: 's-2', title: 'Gistologiya', selectable: true }],
    });
    expect(result.main?.suitability).toBe('unknown');
    expect(result.alternatives[0]?.suitability).toBe('unknown');
  });
});

describe('mapWorkloadBlocks — P-24 maydonlari (isLastSemester, nonAuditHour)', () => {
  const backend: BackendWorkloadDetail = {
    _id: 'w1',
    academicYear: 'ay1',
    directions: [
      {
        direction: 'd1',
        blocks: [
          {
            _id: 'b1',
            course: 1,
            studyWork: { semester: 1, isLastSemester: false },
            otherWork: { items: [{ value: 10 }, { value: 5 }, { value: null }] },
            leadership: 3,
          },
          { _id: 'b2', course: 1, studyWork: { semester: 2 } },
        ],
      },
    ],
  };
  it("isLastSemester=false o'qiladi; otherWork + leadership yig'iladi", () => {
    const [b1] = mapWorkloadBlocks(backend);
    expect(b1?.isLastSemester).toBe(false);
    expect(b1?.nonAuditHour).toBe(18);
  });
  it("maydon yo'q (eski yozuv) → isLastSemester=true (backend defaulti), nonAuditHour=0", () => {
    const [, b2] = mapWorkloadBlocks(backend);
    expect(b2?.isLastSemester).toBe(true);
    expect(b2?.nonAuditHour).toBe(0);
  });
});

describe('mapGroupOption — studentNumber (P-24)', () => {
  it("raqam o'qiladi, yo'q bo'lsa null", () => {
    expect(mapGroupOption({ _id: 'g1', studentNumber: 30 }).studentNumber).toBe(30);
    expect(mapGroupOption({ _id: 'g2' }).studentNumber).toBeNull();
  });
});

describe('mapDistribution — departmentTitle (P-29)', () => {
  it("populate qilingan kafedra nomi olinadi; xom id/yo'q → null", () => {
    expect(
      mapDistribution({ _id: 'x1', department: { _id: 'd1', title: 'Ichki kasalliklar' } })
        .departmentTitle,
    ).toBe('Ichki kasalliklar');
    expect(mapDistribution({ _id: 'x2', department: 'd1' }).departmentTitle).toBeNull();
    expect(mapDistribution({ _id: 'x3' }).departmentTitle).toBeNull();
  });
});

describe('mapDistributionDetail — classTypeSlugs (ADR-034)', () => {
  it("bo'lingan blokda slug'lar o'tadi, eski blokda (maydon yo'q / null) []", () => {
    const backend = {
      _id: 'd-split',
      teachers: [
        {
          _id: 'entry-1',
          teacher: { _id: 'u1', firstName: 'A', lastName: 'B' },
          blocks: [
            { _id: 'b1', totalHour: 17, classTypeSlugs: ['maruza'] },
            { _id: 'b2', totalHour: 31 },
            { _id: 'b3', totalHour: 14, classTypeSlugs: null },
          ],
        },
      ],
    } as unknown as BackendDistributionDetail;
    const blocks = mapDistributionDetail(backend).teachers[0]!.blocks;
    expect(blocks.map((b) => b.classTypeSlugs)).toEqual([['maruza'], [], []]);
  });
});

describe('mapWorkloadBlocks — K3b kontingent maydonlari (departmentId, streamCount, groupCount)', () => {
  it("hujjat kafedrasi + top-level studyWork.stream/group; yo'q bo'lsa null", () => {
    const [withCounts, without] = mapWorkloadBlocks({
      _id: 'w1',
      academicYear: 'ay1',
      department: 'dep1',
      directions: [
        {
          direction: 'd1',
          blocks: [
            { _id: 'b1', course: 2, studyWork: { stream: 2, group: 5 } },
            { _id: 'b2', course: 2, studyWork: {} },
          ],
        },
      ],
    });
    expect(withCounts).toMatchObject({ departmentId: 'dep1', streamCount: 2, groupCount: 5 });
    expect(without).toMatchObject({ departmentId: 'dep1', streamCount: null, groupCount: null });
    expect(mapWorkloadBlocks({ _id: 'w2', department: { _id: 'dep2' }, directions: [{ blocks: [{ _id: 'b' }] }] })[0])
      .toMatchObject({ departmentId: 'dep2' });
    expect(mapWorkloadBlocks({ _id: 'w3', directions: [{ blocks: [{ _id: 'b' }] }] })[0]?.departmentId).toBeNull();
  });
});
