import { toastController } from "@ionic/vue";
import { Group, Route, Rule } from "@/types";
import { DateTime } from "luxon";

// TODO Use separate files for specific utilities

// TODO Remove it when HC APIs are fully REST compliant
const hasError = (response: any) => {
  return !!response.data._ERROR_MESSAGE_ || !!response.data._ERROR_MESSAGE_LIST_;
}

const showToast = async (message: string) => {
  const toast = await toastController
    .create({
      message,
      duration: 3000,
      position: "top",
    })
  return toast.present();
}

const sortSequence = (sequence: Array<Group | Route | Rule>, sortOnField = "sequenceNum") => {
  // Currently, sorting is only performed on a single parameter, so if two sequence have same value for that parameter then they will be arranged in FCFS basis
  // TODO: Need to check that if for the above case we need to define the sorting on name as well, when previous param is same
  return sequence.sort((a: any, b: any) => {
    if(a[sortOnField] === b[sortOnField]) return 0;

    // Sort undefined values at last
    if(a[sortOnField] == undefined) return 1;
    if(b[sortOnField] == undefined) return -1;

    return a[sortOnField] - b[sortOnField]
  })
}

const getTime = (time: any) => {
  // Directly using TIME_SIMPLE for formatting the time results the time always in 24-hour format, as the Intl is set in that way. So, using hourCycle to always get the time in 12-hour format
  // https://github.com/moment/luxon/issues/998
  return time ? DateTime.fromMillis(time).toLocaleString({ ...DateTime.TIME_SIMPLE, hourCycle: "h12" }) : "-";
}

function getDate(runTime: any) {
  return DateTime.fromMillis(runTime).toLocaleString({ ...DateTime.DATE_MED, hourCycle: "h12" });
}

function getDateAndTime(time: any) {
  return time ? DateTime.fromMillis(time).toLocaleString({ ...DateTime.DATETIME_MED, hourCycle: "h12" }) : "-";
}

function getDateAndTimeShort(time: any) {
  // format: hh:mm(localized 12-hour time) date/month
  // Using toLocaleString as toFormat is not converting the time in 12-hour format
  return time ? DateTime.fromMillis(time).toLocaleString({ hour: "numeric", minute: "numeric", day: "numeric", month: "numeric", hourCycle: "h12" }) : "-";
}

function timeTillRun(endTime: any) {
  const timeDiff = DateTime.fromMillis(endTime).diff(DateTime.local());
  return DateTime.local().plus(timeDiff).toRelative();
}

const getColorByDesc = (desc: string) => ({
  "Approved": "primary",
  "Cancelled": "danger",
  "Completed": "success",
  "Created": "medium",
  "Expired": "warning",
  "Hold": "warning",
  "Cancellation Requested": "medium",
  "Rejected": "warning",
  "default": "medium"
} as any)[desc]

export { getColorByDesc, getDate, getDateAndTime, getDateAndTimeShort, getTime, showToast, hasError, sortSequence, timeTillRun }
