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

const generateAllowedFrequencies = (type?: string) => {
  const optionDefault = [{
      "id": "EVERY_5_MIN",
      "description": "Every 5 minutes"
    },{
      "id": "EVERY_15_MIN",
      "description": "Every 15 minutes"
    },{
      "id": "EVERY_30_MIN",
      "description": "Every 30 minutes"
    },{
      "id": "HOURLY",
      "description": "Hourly"
    },{
      "id": "EVERY_6_HOUR",
      "description": "Every 6 hours"
    },{
      "id": "EVERYDAY",
      "description": "Every day"
    }
  ]

  const slow = [{
      "id": "HOURLY",
      "description": "Hourly"
    },{
      "id": "EVERY_6_HOUR",
      "description": "Every 6 hours"
    },{
      "id": "EVERYDAY",
      "description": "Every day"
    }
  ]
  return type === 'slow' ? slow : optionDefault;
}

const generateAllowedRunTimes = () => {
  return [{
    "value": 0,
    "label": "Now"
  }, {
    "value": 300000,
    "label": "In 5 minutes"
  }, {
    "value": 900000,
    "label": "In 15 minutes"
  }, {
    "value": 3600000,
    "label": "In an hour"
  }, {
    "value": 86400000,
    "label": "Tomorrow"
  }, {
    "value": "CUSTOM",
    "label": "Custom"
  }]
}

const getNowTimestamp = () => {
  return DateTime.now().toISO();
}

const isCustomRunTime = (value: number) => {
  return !generateAllowedRunTimes().some((runTime: any) => runTime.value === value)
}

const handleDateTimeInput = (dateTimeValue: any) => {
  // TODO Handle it in a better way
  // Remove timezone and then convert to timestamp
  // Current date time picker picks browser timezone and there is no supprt to change it
  const dateTime = DateTime.fromISO(dateTimeValue, { setZone: true}).toFormat("yyyy-MM-dd'T'HH:mm:ss")
  return DateTime.fromISO(dateTime).toMillis()
}

export { generateAllowedFrequencies, generateAllowedRunTimes, getDate, getDateAndTime, getDateAndTimeShort, getNowTimestamp, getTime, handleDateTimeInput, isCustomRunTime, showToast, hasError, sortSequence, timeTillRun }
