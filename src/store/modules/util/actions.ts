import { ActionTree } from "vuex"
import RootState from "@/store/RootState"
import UtilState from "./UtilState"
import logger from "@/logger"
import { hasError } from "@/utils"
import * as types from "./mutation-types"
import { UtilService } from "@/services/UtilService"
import { EnumerationAndType } from "@/types"

const actions: ActionTree<UtilState, RootState> = {
  async fetchEnums({ commit }, payload) {
    let enums = {}

    try {
      const resp = await UtilService.fetchEnums(payload);

      if(!hasError(resp) && resp.data.length) {
        enums = resp.data.reduce((enumerations: any, data: EnumerationAndType) => {
          if(enumerations[data.enumTypeId]) {
            enumerations[data.enumTypeId][data.enumId] = data
          } else {
            enumerations[data.enumTypeId] = {
              [data.enumId]: data
            }
          }
          return enumerations
        }, {})
      }
    } catch(err) {
      logger.error('error', err)
    }

    commit(types.UTIL_ENUMS_UPDATED, enums)
  }
}

export default actions;