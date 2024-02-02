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

const sortSequence = (sequence: Array<Group | Route | Rule>) => {
  // Currently, sorting is only performed on sequenceNum, so if two seqence have same seqNum then they will be arranged in FCFS basis
  // TODO: Need to check that if for the above case we need to define the sorting on name as well, when seqNum is same
  return sequence.sort((a, b) => a.sequenceNum - b.sequenceNum)
}

const getTime = (time: any) => {
  return time ? DateTime.fromMillis(time).toLocaleString(DateTime.DATETIME_MED) : "-";
}

const getTimeFromSeconds = (time: any) => {
  return time ? DateTime.fromSeconds(time).toLocaleString(DateTime.DATETIME_MED) : "-";
}

export { getTime, getTimeFromSeconds, showToast, hasError, sortSequence }
