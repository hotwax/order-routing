enum Enumeration {
  _entity,
  enumId,
  enumTypeId,
  enumCode,
  sequenceId,
  description,
  enumName,
  sequenceNum,
  lastUpdatedStamp
}

export default interface UtilState {
  enums: Array<Enumeration>
}