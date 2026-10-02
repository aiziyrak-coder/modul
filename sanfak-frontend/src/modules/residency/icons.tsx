import type { ComponentType, CSSProperties, MouseEventHandler } from 'react';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EyeOutlined,
  UserOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  CloseOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CalendarOutlined,
  ReadOutlined,
  BankOutlined,
  TeamOutlined,
  NotificationOutlined,
  LeftOutlined,
  RightOutlined,
  LinkOutlined,
  BarChartOutlined,
  IdcardOutlined,
  ReloadOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';

interface IconProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
  onClick?: MouseEventHandler<HTMLSpanElement>;
  title?: string;
}
type AntIcon = ComponentType<{
  style?: CSSProperties;
  className?: string;
  onClick?: MouseEventHandler<HTMLSpanElement>;
  title?: string;
}>;

function wrap(Icon: AntIcon): ComponentType<IconProps> {
  return function ShimIcon({ size, style, ...rest }: IconProps) {
    return <Icon {...rest} style={size ? { ...style, fontSize: size } : style} />;
  };
}

export const MdAdd = wrap(PlusOutlined);
export const MdEdit = wrap(EditOutlined);
export const MdDelete = wrap(DeleteOutlined);
export const MdSearch = wrap(SearchOutlined);
export const MdVisibility = wrap(EyeOutlined);
export const MdPerson = wrap(UserOutlined);
export const MdArrowBack = wrap(ArrowLeftOutlined);
export const MdArrowForward = wrap(ArrowRightOutlined);
export const MdCheck = wrap(CheckOutlined);
export const MdClose = wrap(CloseOutlined);
export const MdUpload = wrap(UploadOutlined);
export const MdDownload = wrap(DownloadOutlined);
export const MdFileDownload = wrap(DownloadOutlined);
export const MdInsertDriveFile = wrap(FileOutlined);
export const MdDescription = wrap(FileTextOutlined);
export const MdAssignment = wrap(FileTextOutlined);
export const MdCheckCircle = wrap(CheckCircleOutlined);
export const MdCancel = wrap(CloseCircleOutlined);
export const MdAccessTime = wrap(ClockCircleOutlined);
export const MdWarning = wrap(WarningOutlined);
export const MdInfo = wrap(InfoCircleOutlined);
export const MdCalendarToday = wrap(CalendarOutlined);
export const MdEvent = wrap(CalendarOutlined);
export const MdSchool = wrap(ReadOutlined);
export const MdLocalHospital = wrap(BankOutlined);
export const MdGroups = wrap(TeamOutlined);
export const MdCampaign = wrap(NotificationOutlined);
export const MdChevronLeft = wrap(LeftOutlined);
export const MdChevronRight = wrap(RightOutlined);
export const MdLink = wrap(LinkOutlined);
export const MdBarChart = wrap(BarChartOutlined);
export const MdBadge = wrap(IdcardOutlined);
export const MdRefresh = wrap(ReloadOutlined);
export const MdAttachFile = wrap(PaperClipOutlined);
