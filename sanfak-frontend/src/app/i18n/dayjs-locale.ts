import dayjs from 'dayjs';
import uzLatn from 'dayjs/locale/uz-latn';

dayjs.locale('uz', { ...uzLatn, name: 'uz' }, true);
