import { computed, ref, watch, type Ref } from "vue"
import { useAtpProductStore } from "@/store/atpProductStore"

interface FacilityGroupSelection {
  included: any[]
  excluded: any[]
}

export function useFacilityGroupNetOutcome(
  selectedFacilityGroups: Ref<FacilityGroupSelection>,
  areAllSelected: Ref<boolean>
) {
  const productStore = useAtpProductStore()
  const isCounting = ref(false)
  const netFacilityCount = ref(0)
  let requestId = 0

  const hasFacilityGroupSelections = computed(() => {
    return Boolean(selectedFacilityGroups.value.included.length || selectedFacilityGroups.value.excluded.length)
  })

  async function resolveFacilitiesForGroups(groups: any[]) {
    if(!groups.length) return [];

    const responses = await Promise.allSettled(
      groups
        .filter((group: any) => group?.facilityGroupId)
        .map((group: any) => productStore.fetchFacilitiesForGroup(group.facilityGroupId))
    )

    const facilities = [];
    responses.forEach((response: any) => {
      if(response.status === "fulfilled" && Array.isArray(response.value)) {
        response.value.forEach((facility: any) => facilities.push(facility))
      }
    })

    return facilities
  }

  function dedupeFacilities(facilities: any[]) {
    const seen = new Set<string>();
    return facilities.filter((facility: any) => {
      if(!facility?.facilityId || seen.has(facility.facilityId)) return false
      seen.add(facility.facilityId)
      return true
    })
  }

  async function updateNetFacilityCount() {
    if(areAllSelected.value || !hasFacilityGroupSelections.value) {
      isCounting.value = false
      netFacilityCount.value = 0
      return
    }

    const currentRequestId = ++requestId
    isCounting.value = true

    const [includedFacilities, excludedFacilities] = await Promise.all([
      resolveFacilitiesForGroups(selectedFacilityGroups.value.included),
      resolveFacilitiesForGroups(selectedFacilityGroups.value.excluded)
    ])

    if(currentRequestId !== requestId) return;

    const includedIds = new Set(
      dedupeFacilities(includedFacilities).map((facility: any) => facility.facilityId)
    )
    const excludedIds = new Set(
      dedupeFacilities(excludedFacilities).map((facility: any) => facility.facilityId)
    )

    netFacilityCount.value = [...includedIds].filter((id) => !excludedIds.has(id)).length
    isCounting.value = false
  }

  watch(
    [selectedFacilityGroups, areAllSelected],
    updateNetFacilityCount,
    { deep: true, immediate: true }
  )

  return {
    hasFacilityGroupSelections,
    isCounting,
    netFacilityCount
  }
}
