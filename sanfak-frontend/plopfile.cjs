const path = require('node:path');

module.exports = function plopConfig(plop) {
  const tpl = (file) => path.join('tools/generators/templates', file);

  const nameValidate = (value) =>
    /^[a-z][a-z0-9-]*$/.test(value) ||
    'Use lowercase letters, digits and dashes only (kebab-case)';

  plop.setGenerator('module', {
    description:
      'New feature module — fully self-contained under src/modules/<name>/. Touches NO file outside that folder.',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Module name (singular, kebab-case, e.g. "warehouse"):',
        validate: nameValidate,
      },
      {
        type: 'list',
        name: 'variant',
        message: 'Scaffold variant:',
        default: 'blank',
        choices: [
          { name: 'blank — empty page; build any UI you want', value: 'blank' },
          { name: 'crud  — form + table + mock store (replace mock with real fetch later)', value: 'crud' },
        ],
      },
    ],
    actions(data) {
      const base = 'src/modules/{{kebabCase name}}';
      const common = [
        { type: 'add', path: `${base}/{{kebabCase name}}.module.tsx`, templateFile: tpl(`module/${data.variant}/module.hbs`) },
        { type: 'add', path: `${base}/index.ts`, templateFile: tpl('module/blank/index.hbs') },
        { type: 'add', path: `${base}/README.md`, templateFile: tpl('module/blank/readme.hbs') },
      ];

      if (data.variant === 'blank') {
        return [
          ...common,
          { type: 'add', path: `${base}/pages/{{kebabCase name}}-page.tsx`, templateFile: tpl('module/blank/page.hbs') },
          { type: 'add', path: `${base}/components/.gitkeep`, template: '' },
          { type: 'add', path: `${base}/lib/.gitkeep`, template: '' },
          { type: 'add', path: `${base}/model/.gitkeep`, template: '' },
          { type: 'add', path: `${base}/widgets/.gitkeep`, template: '' },
          '\n✅ Module created at src/modules/{{kebabCase name}}/ — route /{{kebabCase name}} is live.\n   The mock session has \'*\' so it shows up immediately.\n',
        ];
      }

      return [
        ...common,
        { type: 'add', path: `${base}/model/types.ts`, templateFile: tpl('module/crud/types.hbs') },
        { type: 'add', path: `${base}/api/mock-store.ts`, templateFile: tpl('module/crud/mock-store.hbs') },
        { type: 'add', path: `${base}/api/{{kebabCase name}}-api.ts`, templateFile: tpl('module/crud/api.hbs') },
        { type: 'add', path: `${base}/pages/{{kebabCase name}}.schema.ts`, templateFile: tpl('module/crud/schema.hbs') },
        { type: 'add', path: `${base}/pages/{{kebabCase name}}-form.tsx`, templateFile: tpl('module/crud/form.hbs') },
        { type: 'add', path: `${base}/pages/{{kebabCase name}}-page.tsx`, templateFile: tpl('module/crud/page.hbs') },
        { type: 'add', path: `${base}/components/.gitkeep`, template: '' },
        { type: 'add', path: `${base}/lib/.gitkeep`, template: '' },
        { type: 'add', path: `${base}/widgets/.gitkeep`, template: '' },
        '\n✅ CRUD module created at src/modules/{{kebabCase name}}/ — route /{{kebabCase name}} is live with form + table + mock store.\n   Replace api/mock-store.ts with real backend calls when ready.\n',
      ];
    },
  });
};
