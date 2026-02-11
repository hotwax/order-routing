<template>
  <div class="circuit-canvas" v-if="activeRouting?.orderRoutingId">
    <!-- Routing Group Column -->
    <div class="routing-group">
      <ion-card class="info">
        <div>
          <ion-card-header>
            <ion-card-title v-show="!isGroupNameUpdating">{{ groupName }}</ion-card-title>
            <ion-input ref="groupNameRef" :class="isGroupNameUpdating ? 'name' : ''" v-show="isGroupNameUpdating" aria-label="group name" v-model="groupName"></ion-input>
            <ion-card-subtitle>{{ group.routingGroupId }}</ion-card-subtitle>
          </ion-card-header>
          <div class="ion-padding">
            <ion-button v-show="!isGroupNameUpdating" fill="outline" size="small" @click="editGroupName()">
              <ion-icon slot="start" :icon="pencilOutline" />
              {{ translate("Rename") }}
            </ion-button>
            <ion-button v-show="isGroupNameUpdating" fill="outline" size="small" @click="updateGroupName()">
              <ion-icon slot="start" :icon="saveOutline" />
              {{ translate("Save") }}
            </ion-button>
            <ion-button fill="outline" size="small" @click="cloneGroup()">
              <ion-icon slot="start" :icon="copyOutline" />
              {{ translate("Clone") }}
            </ion-button>
          </div>
        </div>
        <div>
          <ion-item>
            <ion-label>{{ translate("Created at") }}</ion-label>
            <ion-label slot="end">{{ getDateAndTime(group.createdDate) }}</ion-label>
          </ion-item>
          <ion-item>
            <ion-label>{{ translate("Updated at") }}</ion-label>
            <ion-label slot="end">{{ getDateAndTime(group.lastUpdatedStamp) }}</ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-icon slot="start" :icon="pulseOutline" />
            <ion-select :label="translate('Status')" interface="popover" :interface-options="{ subHeader: translate('Status') }" :value="job.paused || 'Y'" @ionChange="updateGroupStatus($event)">
              <ion-select-option value="N">{{ translate("Active") }}</ion-select-option>
              <ion-select-option value="Y">{{ translate("Draft") }}</ion-select-option>
            </ion-select>
          </ion-item>
        </div>
      </ion-card>

      <ion-card>
        <ion-card-header>
          <div class="header">
            <div>
              <ion-card-subtitle>{{ translate("Scheduler") }}</ion-card-subtitle>
              <ion-card-title>{{ getCronString() || translate("No schedule") }}</ion-card-title>
            </div>
            <ion-button fill="clear" color="medium" @click="openScheduleModal()">
              <ion-icon slot="icon-only" :icon="timerOutline" />
            </ion-button>
          </div>
        </ion-card-header>
        <ion-card-content>
          <p v-if="job?.paused === 'N' && job?.nextExecutionDateTime">{{ translate("Next run") }} {{ timeTillJob(job.nextExecutionDateTime) }}</p>
          <p v-else>{{ translate("Next run") }} -</p>
        </ion-card-content>
        <ion-item lines="none">
          <ion-button fill="outline" color="dark" slot="start" @click="runNow()">{{ translate("Run now") }}</ion-button>
          <ion-button fill="clear" color="medium" slot="end" @click="showGroupHistory()">
            <ion-icon slot="start" :icon="timeOutline" />
            {{ translate("History") }}
          </ion-button>
        </ion-item>
      </ion-card>

      <ion-list-header>
        <ion-label>{{ translate("Routings") }}</ion-label>
      </ion-list-header>
      <ion-list v-if="group.routings?.length">
      <ion-reorder-group v-if="getActiveAndDraftRoutings().length" @ionItemReorder="doRoutingReorder($event)" :disabled="false">
        <ion-card 
          v-for="(routing, index) in getActiveAndDraftRoutings()" 
          :key="routing.orderRoutingId"
          class="routing pointer" 
          :class="{ 'selected-path': activeRoutingId === routing.orderRoutingId, 'reordering-enabled': isReordering }"
          @click="selectRouting(routing)"
          button
        >
        <ion-ripple-effect></ion-ripple-effect>
          <ion-item lines="none">
            <ion-label>
              {{ routing?.routingName }}
            </ion-label>
            <ion-chip slot="end">
              {{ (index as number) + 1 }}/{{ getActiveAndDraftRoutings().length }}
            </ion-chip>
            <ion-reorder slot="end" @pointerdown="isReordering = true" />
          </ion-item>
          <ion-item v-if="routing.filtersCount">
            <ion-label>
              {{ routing.filtersCount }} {{ translate("filters") }}
            </ion-label>
            <ion-icon slot="end" :icon="filterOutline"></ion-icon>
          </ion-item>
          <ion-item v-if="routing.sortCount">
            <ion-label>
              {{ routing.sortCount }} {{ translate("sortings") }}
            </ion-label>
            <ion-icon slot="end" :icon="swapVerticalOutline"></ion-icon>
          </ion-item>
          <ion-item lines="none">
            <ion-badge :color="routing.statusId === 'ROUTING_ACTIVE' ? 'success' : 'medium'">
              {{ getRoutingStatusLabel(routing.statusId) }}
            </ion-badge>
          </ion-item>
        </ion-card>
      </ion-reorder-group>
      <ion-item v-if="getArchivedOrderRoutings().length > 0" @click="openArchivedRoutingModal()" button lines="full">
          <ion-label>{{ translate("Archived") }}</ion-label>
          <ion-badge color="medium">{{ getArchivedOrderRoutings().length }} {{ translate(getArchivedOrderRoutings().length > 1 ? "routings" : "routing") }}</ion-badge>
        </ion-item>
      </ion-list>
      <div v-else class="empty-state">
        <p>{{ translate("No routings available") }}</p>
      </div>
    </div>

    <!-- Routing Column -->
    <div class="routing">
      <ion-card class="summary">
        <ion-item class="title" lines="none">
          <ion-label>
            <p>{{ getRouteIndex() }}</p>
            <h1 v-show="!isRouteNameUpdating">{{ activeRouting?.routingName }}</h1>
            <ion-input ref="routeNameRef" :class="isRouteNameUpdating ? 'name' : ''" v-show="isRouteNameUpdating" aria-label="route name" v-model="routeName"></ion-input>
          </ion-label>
        </ion-item>
        <div class="actions">
          <ion-button size="small" color="medium" fill="outline" @click="isRouteNameUpdating ? updateRouteName() : editRouteName()">
            <ion-icon slot="start" :icon="isRouteNameUpdating ? saveOutline : pencilOutline" />
            <ion-label>{{ isRouteNameUpdating ? translate("Save") : translate("Rename") }}</ion-label>
          </ion-button>
          <ion-button size="small" color="medium" fill="outline" @click="cloneRouting(activeRouting)">
            <ion-icon slot="start" :icon="copyOutline" />
            <ion-label>{{ translate("Clone") }}</ion-label>
          </ion-button>
        </div>
        <ion-item class="history" button @click="openRoutingHistoryModal(activeRoutingId, activeRouting?.routingName)">
          <ion-icon :icon="timeOutline" slot="start"></ion-icon>
          <ion-label>{{ translate("Last run") }}</ion-label>
          <ion-chip slot="end">
            <ion-label>{{ routingHistory[activeRoutingId] ? getDateAndTimeShort(routingHistory[activeRoutingId][0].startDate) : "-" }}</ion-label>
          </ion-chip>
        </ion-item>
        <ion-item class="status" lines="none">
          <ion-icon slot="start" :icon="pulseOutline" />
          <ion-select :label="translate('Status')" interface="popover" :interface-options="{ subHeader: translate('Status') }" :value="routingStatus" @ionChange="updateRoutingStatus($event.detail.value)">
            <ion-select-option value="ROUTING_ACTIVE">{{ translate("Active") }}</ion-select-option>
            <ion-select-option value="ROUTING_DRAFT">{{ translate("Draft") }}</ion-select-option>
            <ion-select-option value="ROUTING_ARCHIVED">{{ translate("Archive") }}</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-card>
      <div class="config">
        <section class="condition">
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ translate("Filters") }}</ion-label>
              <ion-button size="default" v-if="orderRoutingFilterOptions && Object.keys(orderRoutingFilterOptions).length" slot="end" fill="clear" @click="addOrderRouteFilterOptions('ORD_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                  <ion-icon slot="icon-only" :icon="optionsOutline"/>
                </ion-button>
            </ion-item-divider>
            <p class="empty-state" v-if="!orderRoutingFilterOptions || !Object.keys(orderRoutingFilterOptions).length">
              {{ translate("All orders in all parkings will be attempted if no filter is applied.") }}
              <ion-button fill="clear" @click="addOrderRouteFilterOptions('ORD_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                  {{ translate("Add filters") }}
                  <ion-icon slot="end" :icon="optionsOutline"/>
                </ion-button>
            </p>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE')">
              <ion-select multiple :placeholder="translate('queue')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'QUEUE', true)">
                <div slot="label">
                  {{ translate("Queue") }}
                </div>
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE_EXCLUDED')">
              <ion-select multiple :placeholder="translate('queue')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'QUEUE_EXCLUDED', true)">
                <div slot="label">
                  <ion-label>{{ translate("Queue") }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD')">
              <ion-select multiple :placeholder="translate('shipping method')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SHIPPING_METHOD', true)">
                <div slot="label">
                  {{ translate("Shipping method") }}
                </div>
                <ion-select-option v-for="(shippingMethod, shippingMethodId) in shippingMethods" :key="shippingMethodId" :value="shippingMethodId">{{ shippingMethod.description || shippingMethodId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD_EXCLUDED')">
              <ion-select multiple :placeholder="translate('shipping method')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SHIPPING_METHOD_EXCLUDED', true)">
                <div slot="label">
                  <ion-label>{{ translate('Shipping method') }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(shippingMethod, shippingMethodId) in shippingMethods" :key="shippingMethodId" :value="shippingMethodId">{{ shippingMethod.description || shippingMethodId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY')">
              <ion-select :placeholder="translate('priority')" interface="popover" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY').fieldValue" @ionChange="updateOrderFilterValue($event, 'PRIORITY')">
                <div slot="label">
                  {{ translate("Order priority") }}
                </div>
                <ion-select-option value="HIGH">{{ translate("High") }}</ion-select-option>
                <ion-select-option value="MEDIUM">{{ translate("Medium") }}</ion-select-option>
                <ion-select-option value="Low">{{ translate("Low") }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY_EXCLUDED')">
              <ion-select :placeholder="translate('priority')" interface="popover" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY_EXCLUDED').fieldValue" @ionChange="updateOrderFilterValue($event, 'PRIORITY_EXCLUDED')">
                <div slot="label">
                  <ion-label>{{ translate('Order priority') }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option value="HIGH">{{ translate("High") }}</ion-select-option>
                <ion-select-option value="MEDIUM">{{ translate("Medium") }}</ion-select-option>
                <ion-select-option value="Low">{{ translate("Low") }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL')">
              <ion-select multiple :placeholder="translate('sales channel')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SALES_CHANNEL', true)">
                <div slot="label">
                  {{ translate("Sales Channel") }}
                </div>
                <ion-select-option v-for="(enumInfo, enumId) in enums['ORDER_SALES_CHANNEL']" :key="enumId" :value="enumId">{{ enumInfo.description || enumInfo.enumId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL_EXCLUDED')">
              <ion-select multiple :placeholder="translate('sales channel')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SALES_CHANNEL_EXCLUDED', true)">
                <div slot="label">
                  <ion-label>{{ translate('Sales Channel') }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(enumInfo, enumId) in enums['ORDER_SALES_CHANNEL']" :key="enumId" :value="enumId">{{ enumInfo.description || enumInfo.enumId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP')">
              <ion-select multiple :placeholder="translate('facility group')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'ORIGIN_FACILITY_GROUP', true)">
                <div slot="label">
                  {{ translate("Origin Facility Group") }}
                </div>
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in facilityGroups" :key="facilityGroupId" :value="facilityGroupId">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP_EXCLUDED')">
              <ion-select multiple :placeholder="translate('facility group')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'ORIGIN_FACILITY_GROUP_EXCLUDED', true)">
                <div slot="label">
                  <ion-label>{{ translate('Origin Facility Group') }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in facilityGroups" :key="facilityGroupId" :value="facilityGroupId">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-item-group>
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ translate("Sort") }}</ion-label>
              <ion-button size="default" v-if="orderRoutingSortOptions && Object.keys(orderRoutingSortOptions).length" slot="end" fill="clear" @click="addOrderRouteFilterOptions('ORD_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                  <ion-icon slot="icon-only" :icon="optionsOutline"/>
                </ion-button>
            </ion-item-divider>
            <p class="empty-state" v-if="!orderRoutingSortOptions || !Object.keys(orderRoutingSortOptions).length">
              {{ translate("Orders will be brokered based on order date if no sorting is specified.") }}
              <ion-button fill="clear" @click="addOrderRouteFilterOptions('ORD_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                  {{ translate("Add sorting") }}
                  <ion-icon slot="end" :icon="optionsOutline"/>
                </ion-button>
            </p>
            <ion-reorder-group @ionItemReorder="doRouteSortReorder($event)" :disabled="false">
              <ion-item v-for="(sort, code) in orderRoutingSortOptions" :key="code">
                <ion-label>{{ getLabel("ORD_SORT_PARAM_TYPE", String(code)) || code }}</ion-label>
                <ion-reorder @pointerdown="isReordering = true" />
              </ion-item>
            </ion-reorder-group>
          </ion-item-group>
        </section>
        <section class="rules">
          <ion-list>
            <ion-list-header>
              <ion-label>{{ translate("Routing rules") }}</ion-label>
            </ion-list-header>
              
            <ion-reorder-group @ionItemReorder="doReorder($event)" :disabled="false">
              <ion-item class="rule-item" lines="full" v-for="rule in rulesForReorder" :key="rule.routingRuleId" :disabled="isReordering" :color="rule.routingRuleId === activeRuleId ? 'light' : ''" @click="selectRule(rule)" button>
                <ion-label>
                  <h2>{{ rule.ruleName }}</h2>
                  <ion-note :color="rule.statusId === 'RULE_ACTIVE' ? 'success' : rule.statusId === 'RULE_ARCHIVED' ? 'warning' : ''">{{ rule.statusId === "RULE_ACTIVE" ? translate("Active") : rule.statusId === "RULE_ARCHIVED" ? translate("Archived") : translate("Draft") }}</ion-note>
                </ion-label>
                <!-- Don't display reordering option when there is a single rule -->
                <ion-reorder v-show="rulesForReorder.length > 1" @pointerdown="isReordering = true" />
              </ion-item>
            </ion-reorder-group>
            <ion-item v-if="getArchivedOrderRules().length > 0" @click="openArchivedRuleModal()" button lines="full">
              <ion-label>{{ translate("Archived") }}</ion-label>
              <ion-badge color="medium">{{ getArchivedOrderRules().length }} {{ translate(getArchivedOrderRules().length > 1 ? "rules" : "rule") }}</ion-badge>
            </ion-item>
          </ion-list>
          <ion-button fill="outline" @click="addInventoryRule()">
            {{ translate("Add inventory rule") }}
            <ion-icon :icon="addCircleOutline" slot="end"/>
          </ion-button>
        </section>
      </div>
    </div>

    <!-- Routing Rules Column -->
    <div class="routing-rule">
      <div v-if="activeRule?.routingRuleId">
        <ion-card class="summary">
          <ion-item class="title" lines="none">
            <ion-label>
              <p>{{ getRuleIndex() }}</p>
              <h1 v-show="!isRuleNameUpdating">{{ selectedRoutingRule.ruleName }}</h1>
            </ion-label>
            <!-- Added class as we can't change the background of ion-input with css property, and we need to change the background to show the user that now this value is editable -->
            <ion-input ref="ruleNameRef" :class="isRuleNameUpdating ? 'name' : ''" v-show="isRuleNameUpdating" aria-label="rule name" v-model="selectedRoutingRule.ruleName"></ion-input>
          </ion-item>
          <div class="actions">
            <ion-button size="small" @click="isRuleNameUpdating ? updateRuleName(selectedRoutingRule.routingRuleId) : editRuleName()" fill="outline">
              <ion-icon slot="start" :icon="isRuleNameUpdating ? saveOutline : pencilOutline" />
              {{ isRuleNameUpdating ? translate("Save") : translate("Rename") }}
            </ion-button>
          </div>
          <ion-item lines="none" class="status">
            <ion-icon slot="start" :icon="pulseOutline" />
            <ion-select :label="translate('Status')" interface="popover" :value="getRuleStatus(selectedRoutingRule.routingRuleId)" :interface-options="{ subHeader: translate('Status') }" @ionChange="updateRuleStatus($event, selectedRoutingRule.routingRuleId)">
              <ion-select-option value="RULE_ACTIVE">{{ translate("Active") }}</ion-select-option>
              <ion-select-option value="RULE_DRAFT">{{ translate("Draft") }}</ion-select-option>
              <ion-select-option value="RULE_ARCHIVED">{{ translate("Archived") }}</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-card>
        <section class="config">
          <ion-card class="filter">
            <ion-item lines="none">
              <ion-icon slot="start" :icon="filterOutline"/>
              <ion-label>
                <h2>{{ translate("Filters") }}</h2>
              </ion-label>
              <ion-button size="default" v-if="isInventoryRuleFiltersApplied()" slot="end" fill="clear" @click="addInventoryFilterOptions('INV_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </ion-item>
            <p class="empty-state" v-if="!isInventoryRuleFiltersApplied()">
              {{ translate("All facilities enabled for online fulfillment will be attempted for brokering if no filter is applied.") }}<br /><br />
              <span><a target="_blank" rel="noopener noreferrer" href="https://docs.hotwax.co/documents/v/system-admins/administration/facilities/configure-fulfillment">{{ translate("Learn more") }}</a>{{ translate(" about enabling a facility for online fulfillment.") }}</span>
              <ion-button fill="clear" @click="addInventoryFilterOptions('INV_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                {{ translate("Add filters") }}
                <ion-icon slot="end" :icon="optionsOutline"/>
              </ion-button>
            </p>
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP')">
              <ion-select :placeholder="translate('facility group')" interface="popover" :label="translate('Group')" :selected-text="getSelectedValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP') || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP').fieldValue" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP').fieldValue" @ionChange="updateRuleFilterValue($event, 'FACILITY_GROUP')">
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in getFacilityGroupsForBrokering()" :key="facilityGroupId" :value="facilityGroupId" :disabled="isFacilityGroupSelected(facilityGroupId, 'included')">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED')">
              <ion-select :placeholder="translate('facility group')" interface="popover" :selected-text="getSelectedValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED') || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED').fieldValue" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED').fieldValue" @ionChange="updateRuleFilterValue($event, 'FACILITY_GROUP_EXCLUDED')">
                <div slot="label">
                  <ion-label>{{ translate("Group") }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in getFacilityGroupsForBrokering()" :key="facilityGroupId" :value="facilityGroupId" :disabled="isFacilityGroupSelected(facilityGroupId, 'excluded')">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'PROXIMITY')">
              <ion-label>{{ translate("Proximity") }}</ion-label>
              <div>
                <ion-chip outline @click.stop="chipClickEvent(measurementRef)">
                  <ion-select @click.stop ref="measurementRef" :placeholder="translate('measurement unit')" aria-label="measurement" interface="popover" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'MEASUREMENT_SYSTEM')?.fieldValue" @ionChange="updateRuleFilterValue($event, 'MEASUREMENT_SYSTEM')">
                    <ion-select-option value="METRIC">{{ translate("kms") }}</ion-select-option>
                    <ion-select-option value="IMPERIAL">{{ translate("miles") }}</ion-select-option>
                  </ion-select>
                </ion-chip>
                <ion-chip outline @click="selectValue('PROXIMITY', 'Add proximity')">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "PROXIMITY").fieldValue || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "PROXIMITY").fieldValue == 0 ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "PROXIMITY").fieldValue : "-" }}</ion-chip>
              </div>
            </ion-item>
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'BRK_SAFETY_STOCK')">
              <ion-label>{{ translate("Brokering safety stock") }}</ion-label>
              <div>
                <ion-chip outline @click.stop="chipClickEvent(operatorRef)">
                  <ion-select @click.stop ref="operatorRef" :placeholder="translate('operator')" aria-label="operator" interface="popover" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'BRK_SAFETY_STOCK').operator" @ionChange="updateOperator($event)">
                    <ion-select-option value="greater-equals">{{ translate("greater than or equal to") }}</ion-select-option>
                    <ion-select-option value="greater">{{ translate("greater") }}</ion-select-option>
                  </ion-select>
                </ion-chip>
                <ion-chip outline @click="selectValue('BRK_SAFETY_STOCK', 'Add safety stock', 'greater')">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "BRK_SAFETY_STOCK").fieldValue || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "BRK_SAFETY_STOCK").fieldValue == 0 ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "BRK_SAFETY_STOCK").fieldValue : "-" }}</ion-chip>
              </div>
            </ion-item>

            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_ORDER_LIMIT')">
              <ion-toggle :checked="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_ORDER_LIMIT').fieldValue === 'Y'" @ionChange="updateRuleFilterValue($event, 'FACILITY_ORDER_LIMIT')">
                <ion-label class="ion-text-wrap">
                  {{ translate("Turn off the facility order limit check") }}
                </ion-label>
              </ion-toggle>
            </ion-item>
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'SHIP_THRESHOLD')">
              <ion-label>{{ translate('Shipment threshold check') }}</ion-label>
              <ion-chip slot="end" outline @click="selectValue('SHIP_THRESHOLD', 'Add shipment threshold check')">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "SHIP_THRESHOLD").fieldValue || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "SHIP_THRESHOLD").fieldValue == 0 ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "SHIP_THRESHOLD").fieldValue : "-" }}</ion-chip>
            </ion-item>
          </ion-card>
          <ion-card class="sort">
            <ion-item lines="none">
              <ion-icon slot="start" :icon="swapVerticalOutline"/>
              <ion-label>
                <h2>{{ translate("Sort") }}</h2>
              </ion-label>
              <ion-button size="default" v-if="inventoryRuleSortOptions && Object.keys(inventoryRuleSortOptions).length" slot="end" fill="clear" @click="addInventoryFilterOptions('INV_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </ion-item>
            <p class="empty-state" v-if="!inventoryRuleSortOptions || !Object.keys(inventoryRuleSortOptions).length">
              {{ translate("Facilities will be sorted based on creation date if no sorting preferences are applied.") }}
              <ion-button fill="clear" @click="addInventoryFilterOptions('INV_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                {{ translate("Add sorting") }}
                <ion-icon slot="end" :icon="optionsOutline"/>
              </ion-button>
            </p>
            <ion-reorder-group @ionItemReorder="doConditionSortReorder($event)" :disabled="false">
              <ion-item v-for="(sort, code) in inventoryRuleSortOptions" :key="code">
                <ion-label>{{ getLabel("INV_SORT_PARAM_TYPE", String(code)) || code }}</ion-label>
                <ion-reorder @pointerdown="isReordering = true" />
              </ion-item>
            </ion-reorder-group>
          </ion-card>
          <ion-card class="split">
            <ion-card-header>
              <ion-card-title>
                {{ translate("Partially available") }}
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              {{ translate("Select if partial allocation should be allowed in this inventory rule") }}
            </ion-card-content>
            <ion-item lines="none">
              <ion-toggle :disabled="isPromiseDateFilterApplied()" :checked="activeRule.assignmentEnumId === 'ORA_MULTI'" @ionChange="updatePartialAllocation($event.detail.checked)">{{ translate("Allow partial allocation") }}</ion-toggle>
            </ion-item>
            <ion-item v-show="isPromiseDateFilterApplied()" lines="none">
              <ion-label class="ion-text-wrap">
                <p>{{ translate("Partial allocation cannot be disabled. Orders are filtered by item when filtering by promise date.") }}</p>
              </ion-label>
            </ion-item>
            <ion-item lines="none">
              <ion-toggle :disabled="activeRule.assignmentEnumId !== 'ORA_MULTI' && !isPromiseDateFilterApplied()" :checked="isPartialGroupItemsAllocationActive()" @ionChange="updatePartialGroupItemsAllocation($event.detail.checked)">{{ translate("Partially allocate grouped items") }}</ion-toggle>
            </ion-item>
          </ion-card>
          <ion-card class="unavailable">
            <ion-card-header>
              <ion-card-title>
                {{ translate("Unavailable items") }}
              </ion-card-title>
            </ion-card-header>
            <ion-item lines="none">
              <ion-select :placeholder="translate('action')" :label="translate('Move items to')" interface="popover" :value="ruleActionType" @ionChange="updateUnfillableActionType($event.detail.value)">
                <ion-select-option :value="actionEnums['NEXT_RULE'].id">
                  {{ translate("Next rule") }}
                  <ion-icon :icon="playForwardOutline"/>
                </ion-select-option>
                <ion-select-option :value="actionEnums['MOVE_TO_QUEUE'].id">
                  {{ translate("Queue") }}
                  <ion-icon :icon="golfOutline"/>
                </ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item lines="none" v-show="ruleActionType === actionEnums['MOVE_TO_QUEUE'].id">
              <ion-select :placeholder="translate('queue')" :label="translate('Queue')" interface="popover" :value="inventoryRuleActions[ruleActionType]?.actionValue" @ionChange="updateRuleActionValue($event.detail.value)">
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item lines="none">
              <ion-toggle :checked="JSON.parse(inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue ? inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue : false)" @ionChange="clearAutoCancelDays($event.detail.checked)">{{ translate("Clear auto cancel days") }}</ion-toggle>
            </ion-item>
            <ion-item lines="none" v-show="!JSON.parse(inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue ? inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue : false)">
              <ion-label>{{ translate("Auto cancel days") }}</ion-label>
              <ion-chip outline @click="updateAutoCancelDays()">
                <template v-if="inventoryRuleActions[actionEnums['AUTO_CANCEL_DAYS'].id]?.actionValue">
                  <ion-icon :icon="closeCircleOutline" @click.stop="removeAutoCancelDays()"/>
                  <ion-label>{{ `${inventoryRuleActions[actionEnums["AUTO_CANCEL_DAYS"].id].actionValue} days` }}</ion-label>
                </template>
                <template v-else>
                  {{ translate("select days") }}
                </template>
              </ion-chip>
            </ion-item>
          </ion-card>
        </section>
      </div>
    </div>
    <ion-fab vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button :disabled="!hasUnsavedChanges" @click="save">
        <ion-icon :icon="saveOutline" />
      </ion-fab-button>
    </ion-fab>
  </div>

  <!-- Empty State -->
  <div class="empty-state-canvas" v-else>
    <div class="empty-state-content">
      <div class="empty-content-wrapper">
        <div class="icon-container">
          <ion-icon :icon="gitNetworkOutline" />
        </div>
        <h2>{{ translate("Select a Routing Context") }}</h2>
        <p class="description">{{ translate("Select a routing from the list to view its details and manage inventory rules.") }}</p>
        
        <div class="action-prompt">
          <ion-icon :icon="sparklesOutline" />
          <p>{{ translate("Ask Circuit to help you create or modify rules") }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { 
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip, 
  IonIcon, 
  IonInput,
  IonItem,
  IonItemDivider,
  IonItemGroup,
  IonLabel,
  IonList,
  IonNote,
  IonRippleEffect,
  IonReorder,
  IonReorderGroup,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonFab,
  IonFabButton,
  modalController,
  alertController
} from '@ionic/vue';
import { 
  filterOutline, 
  swapVerticalOutline,
  timeOutline,
  pencilOutline,
  copyOutline,
  closeCircleOutline,
  optionsOutline,
  addCircleOutline,
  pulseOutline,
  saveOutline,
  golfOutline,
  playForwardOutline,
  gitNetworkOutline,
  sparklesOutline,
  timerOutline,
} from 'ionicons/icons';
import { translate } from '@/i18n';
import { computed, defineProps, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { OrderRoutingService } from "@/services/RoutingService";
import { getDateAndTime, getDateAndTimeShort, hasError, showToast, sortSequence } from "@/utils";
import logger from "@/logger";
import { useStore } from "vuex";
import emitter from '@/event-bus';
import AddOrderRouteFilterOptions from "@/components/AddOrderRouteFilterOptions.vue"
import { Rule } from "@/types";
import AddInventoryFilterOptionsModal from "@/components/AddInventoryFilterOptionsModal.vue";
import cronstrue from "cronstrue"
import { DateTime } from "luxon";
import ScheduleModal from "@/components/ScheduleModal.vue";
import GroupHistoryModal from "@/components/GroupHistoryModal.vue"
import RoutingHistoryModal from "@/components/RoutingHistoryModal.vue"
import ArchivedRoutingModal from "@/components/ArchivedRoutingModal.vue"
import ArchivedRuleModal from "@/components/ArchivedRuleModal.vue"

const props = defineProps({
  routingGroupId: {
    type: String,
    required: false
  }
})

const store = useStore();
const routingGroupId = computed(() => props.routingGroupId || null);
const group = ref({}) as any;
const originalGroup = ref({}) as any;
const activeRoutingId = ref('');
const activeRuleId = ref('');
const activeRouting = ref(null) as any;
const activeRule = ref(null) as any;

const orderRoutingFilterOptions = ref({}) as any;
const orderRoutingSortOptions = ref({}) as any;
const inventoryRules = ref([]) as any;
const rulesForReorder = ref([]) as any;
const inventoryRuleFilterOptions = ref({}) as any;
const inventoryRuleSortOptions = ref({}) as any;
const isRouteNameUpdating = ref(false)
const routeName = ref("")
const routeNameRef = ref()
const inventoryRuleActions = ref({}) as any;
const ruleActionType = ref("");
const actionEnums = JSON.parse(process.env?.VUE_APP_RULE_ACTION_ENUMS as string || '{}');
const conditionFilterEnums = JSON.parse(process.env?.VUE_APP_RULE_FILTER_ENUMS as string || '{}');
const TEMP_ID_PREFIX = "__tmp__";
const tempIdCounter = ref(0);

const groupName = ref("");
const isGroupNameUpdating = ref(false);
const groupNameRef = ref();
const isReordering = ref(false);
const job = ref({}) as any;
const groupHistory = ref([]) as any;

const ruleEnums = {
  "QUEUE": { "id": "OIP_QUEUE", "code": "facilityId" },
  "QUEUE_EXCLUDED": { "id": "OIP_QUEUE_EXCLUDED", "code": "facilityId_excluded" },
  "SHIPPING_METHOD": { "id": "OIP_SHIP_METH_TYPE", "code": "shipmentMethodTypeId" },
  "SHIPPING_METHOD_EXCLUDED": { "id": "OIP_SHIP_METH_TYPE_EXCLUDED", "code": "shipmentMethodTypeId_excluded" },
  "PRIORITY": { "id": "OIP_PRIORITY", "code": "priority" },
  "PRIORITY_EXCLUDED": { "id": "OIP_PRIORITY_EXCLUDED", "code": "priority_excluded" },
  "PROMISE_DATE": { "id": "OIP_PROMISE_DATE", "code": "promiseDaysCutoff" },
  "PROMISE_DATE_EXCLUDED": { "id": "OIP_PROMISE_DATE_EXCLUDED", "code": "promiseDaysCutoff_excluded" },
  "SALES_CHANNEL": { "id": "OIP_SALES_CHANNEL", "code": "salesChannelEnumId" },
  "SALES_CHANNEL_EXCLUDED": { "id": "OIP_SALES_CHANNEL_EXCLUDED", "code": "salesChannelEnumId_excluded" },
  "ORIGIN_FACILITY_GROUP": { "id": "OIP_ORIGIN_FAC_GRP", "code": "originFacilityGroupId" },
  "ORIGIN_FACILITY_GROUP_EXCLUDED": { "id": "OIP_ORIGIN_FAC_GRP_EXCLUDED", "code": "originFacilityGroupId_excluded" }
};

const facilities = computed(() => store.getters["util/getVirtualFacilities"]);
const enums = computed(() => store.getters["util/getEnums"]);
const shippingMethods = computed(() => store.getters["util/getShippingMethods"]);
const facilityGroups = computed(() => store.getters["util/getFacilityGroups"]);
const routingHistory = computed(() => store.getters["orderRouting/getRoutingHistory"])
const userProfile = computed(() => store.getters["user/getUserProfile"])

const operatorRef = ref()
const measurementRef = ref()

const currentRoutingGroup: any = computed(() => store.getters["orderRouting/getCurrentRoutingGroup"])

const getStatusDesc = computed(() => (id: string) => store.getters["util/getStatusDesc"](id))
const routingStatus = computed(() => activeRouting.value?.statusId)
const selectedRoutingRule = computed(() => activeRule.value || {})
const getRuleStatus = computed(() => (ruleId: string) => rulesForReorder.value.find((rule: Rule) => rule.routingRuleId == ruleId)?.statusId)
const filterSortDesc = process.env.VUE_APP_FILTER_SORT_DESC as string || ""

function getRoutingStatusLabel(statusId: string) {
  const label = getStatusDesc.value(statusId)
  if (label && label !== statusId) return label

  if (statusId === "ROUTING_ACTIVE") return translate("Active")
  if (statusId === "ROUTING_DRAFT") return translate("Draft")
  if (statusId === "ROUTING_ARCHIVED") return translate("Archived")

  return statusId || "-"
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function generateTempId() {
  tempIdCounter.value += 1
  return `${TEMP_ID_PREFIX}${DateTime.now().toMillis()}_${tempIdCounter.value}`
}

function getUiFieldName(condition: any) {
  let fieldName = condition.fieldName || ""

  if (filterSortDesc.includes(fieldName)) {
    fieldName = fieldName.replace(" desc", "").replace(" DESC", "")
  }

  if (condition.operator === "not-equals" || condition.operator === "not-in") {
    return `${fieldName}_excluded`
  }
  return fieldName
}

function normalizeRuleForUi(rule: any) {
  const inventoryFilters = Array.isArray(rule.inventoryFilters) ? sortSequence(deepClone(rule.inventoryFilters)) : []
  const groupedFilters = inventoryFilters.reduce((filters: any, condition: any) => {
    const conditionType = condition.conditionTypeEnumId
    const fieldName = getUiFieldName(condition)
    const updatedCondition = { ...condition, fieldName }

    if (filters[conditionType]) {
      filters[conditionType][fieldName] = updatedCondition
    } else {
      filters[conditionType] = { [fieldName]: updatedCondition }
    }
    return filters
  }, {})

  const actions = Array.isArray(rule.actions) ? rule.actions.reduce((actionsMap: any, action: any) => {
    actionsMap[action.actionTypeEnumId] = action
    return actionsMap
  }, {}) : (rule.actions || {})

  return {
    ...rule,
    inventoryFilters: groupedFilters,
    actions
  }
}

function normalizeGroupForUi(rawGroup: any) {
  const normalizedGroup = deepClone(rawGroup || {})

  normalizedGroup.routings = sortSequence(normalizedGroup.routings || []).map((routing: any) => {
    const orderFilters = sortSequence(deepClone(routing.orderFilters || []))
    const rules = sortSequence((routing.rules || []).map((rule: any) => normalizeRuleForUi(rule)))
    return {
      ...routing,
      orderFilters,
      rules,
      filtersCount: orderFilters.filter((condition: any) => condition.conditionTypeEnumId === "ENTCT_FILTER").length,
      sortCount: orderFilters.filter((condition: any) => condition.conditionTypeEnumId === "ENTCT_SORT_BY").length
    }
  })

  return normalizedGroup
}

function toBackendCondition(condition: any) {
  const updatedCondition = { ...condition }
  const isExcluded = typeof updatedCondition.fieldName === "string" && updatedCondition.fieldName.endsWith("_excluded")

  if (isExcluded) {
    updatedCondition.fieldName = updatedCondition.fieldName.replace("_excluded", "")
    if (!updatedCondition.operator || updatedCondition.operator === "equals") {
      updatedCondition.operator = String(updatedCondition.fieldValue).includes(",") ? "not-in" : "not-equals"
    }
  }

  return updatedCondition
}

function toArrayMap(values: any, sortBySequence = false) {
  const list = Object.values(values || {})
  return sortBySequence ? sortSequence(list) : list
}

function buildDraftRoutingClone(routing: any, forceDraftStatus = false) {
  const clonedRouting = deepClone(routing)
  clonedRouting.orderRoutingId = generateTempId()
  clonedRouting.routingName = `${routing.routingName || translate("Routing")} copy`
  if (forceDraftStatus) {
    clonedRouting.statusId = "ROUTING_DRAFT"
  }
  clonedRouting.createdDate = DateTime.now().toMillis()
  clonedRouting.lastUpdatedStamp = undefined

  clonedRouting.orderFilters = (clonedRouting.orderFilters || []).map((condition: any) => ({
    ...condition,
    conditionSeqId: generateTempId(),
    createdDate: DateTime.now().toMillis(),
    lastUpdatedStamp: undefined
  }))

  clonedRouting.rules = (clonedRouting.rules || []).map((rule: any) => {
    const clonedRule = deepClone(rule)
    clonedRule.routingRuleId = generateTempId()
    clonedRule.createdDate = DateTime.now().toMillis()
    clonedRule.lastUpdatedStamp = undefined

    const filterMap = clonedRule.inventoryFilters?.ENTCT_FILTER || {}
    const sortMap = clonedRule.inventoryFilters?.ENTCT_SORT_BY || {}
    clonedRule.inventoryFilters = {
      ENTCT_FILTER: Object.keys(filterMap).reduce((filters: any, key: string) => {
        filters[key] = {
          ...filterMap[key],
          routingRuleId: clonedRule.routingRuleId,
          conditionSeqId: generateTempId(),
          createdDate: DateTime.now().toMillis(),
          lastUpdatedStamp: undefined
        }
        return filters
      }, {}),
      ENTCT_SORT_BY: Object.keys(sortMap).reduce((filters: any, key: string) => {
        filters[key] = {
          ...sortMap[key],
          routingRuleId: clonedRule.routingRuleId,
          conditionSeqId: generateTempId(),
          createdDate: DateTime.now().toMillis(),
          lastUpdatedStamp: undefined
        }
        return filters
      }, {})
    }

    clonedRule.actions = Object.keys(clonedRule.actions || {}).reduce((actions: any, actionTypeId: string) => {
      actions[actionTypeId] = {
        ...clonedRule.actions[actionTypeId],
        routingRuleId: clonedRule.routingRuleId,
        actionSeqId: generateTempId(),
        createdDate: DateTime.now().toMillis(),
        lastUpdatedStamp: undefined
      }
      return actions
    }, {})

    return clonedRule
  })

  return clonedRouting
}

function toSerializableGroup(payloadGroup: any) {
  const serializedGroup = deepClone(payloadGroup || {})
  serializedGroup.routings = (serializedGroup.routings || []).map((routing: any) => {
    const updatedRouting = { ...routing }
    const isNewRouting = String(updatedRouting.orderRoutingId || "").startsWith(TEMP_ID_PREFIX)
    if (isNewRouting) {
      delete updatedRouting.orderRoutingId
    }

    updatedRouting.orderFilters = (updatedRouting.orderFilters || []).map((condition: any) => {
      const serializedCondition = toBackendCondition(condition)
      if (isNewRouting) {
        delete serializedCondition.conditionSeqId
      }
      if (String(serializedCondition.conditionSeqId || "").startsWith(TEMP_ID_PREFIX)) {
        delete serializedCondition.conditionSeqId
      }
      return serializedCondition
    })

    updatedRouting.rules = (updatedRouting.rules || []).map((rule: any) => {
      const serializedRule = { ...rule }
      const isNewRule = String(serializedRule.routingRuleId || "").startsWith(TEMP_ID_PREFIX)
      if (String(serializedRule.routingRuleId || "").startsWith(TEMP_ID_PREFIX)) {
        delete serializedRule.routingRuleId
      }

      const filterMap = serializedRule.inventoryFilters?.ENTCT_FILTER || {}
      const sortMap = serializedRule.inventoryFilters?.ENTCT_SORT_BY || {}
      serializedRule.inventoryFilters = [
        ...toArrayMap(filterMap, true),
        ...toArrayMap(sortMap, true)
      ].map((condition: any) => {
        const serializedCondition = toBackendCondition(condition)
        if (isNewRule || String(serializedCondition.routingRuleId || "").startsWith(TEMP_ID_PREFIX)) {
          delete serializedCondition.routingRuleId
        }
        if (String(serializedCondition.conditionSeqId || "").startsWith(TEMP_ID_PREFIX)) {
          delete serializedCondition.conditionSeqId
        }
        return serializedCondition
      })

      serializedRule.actions = toArrayMap(serializedRule.actions).map((action: any) => {
        const serializedAction = { ...action }
        if (isNewRule || String(serializedAction.routingRuleId || "").startsWith(TEMP_ID_PREFIX)) {
          delete serializedAction.routingRuleId
        }
        if (String(serializedAction.actionSeqId || "").startsWith(TEMP_ID_PREFIX)) {
          delete serializedAction.actionSeqId
        }
        return serializedAction
      })

      return serializedRule
    })

    delete updatedRouting.filtersCount
    delete updatedRouting.sortCount
    return updatedRouting
  })

  return serializedGroup
}

function isInventoryRuleFiltersApplied() {
  const ruleFilters = Object.keys(inventoryRuleFilterOptions.value).filter((rule: string) => rule !== conditionFilterEnums["SPLIT_ITEM_GROUP"]?.code);
  return ruleFilters.length
}

function getFacilityGroupsForBrokering(): { [key: string]: any } {
  const groups = Object.values(facilityGroups.value || {})
  return groups.reduce((facilityGroups: { [key: string]: any }, group: any) => {
    if(group.facilityGroupTypeId === "BROKERING_GROUP") {
      facilityGroups[group.facilityGroupId] = group
    }
    return facilityGroups
  }, {} as { [key: string]: any })
}

function isFacilityGroupSelected(facilityGroupId: string, type: string) {
  const facilityGroupIncluded = getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, 'FACILITY_GROUP')?.fieldValue;
  const facilityGroupExcluded = getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED')?.fieldValue;

  if (type === 'included') {
    return facilityGroupExcluded === facilityGroupId;
  } else {
    return facilityGroupIncluded === facilityGroupId;
  }
}

async function chipClickEvent(ref: any) {
  ref.$el.click();
}

async function selectValue(parameter: string, label: string, operator = "") {
  const alert = await alertController.create({
    header: translate(label),
    inputs: [{
      name: "fieldValue",
      type: "number",
      value: getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, parameter)?.fieldValue
    }],
    buttons: [{
      text: translate("Cancel"),
      role: "cancel"
    }, {
      text: translate("Save"),
      handler: (data) => {
        updateRuleFilterValue({ detail: { value: data.fieldValue } }, parameter, operator)
      }
    }]
  });

  await alert.present();
}

function isPromiseDateFilterApplied() {
  return !!(getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE") || getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE_EXCLUDED"))
}

function isPartialGroupItemsAllocationActive() {
  return !!(activeRule.value?.assignmentEnumId === 'ORA_MULTI' && getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, "SPLIT_ITEM_GROUP")?.fieldValue === 'Y')
}

function getPromiseDateValue() {
  const promiseDateFilter = getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE") || getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE_EXCLUDED")
  return promiseDateFilter?.fieldValue || '-'
}

const isRuleNameUpdating = ref(false)
const hasUnsavedChanges = ref(false)
const ruleNameRef = ref()

onMounted(async () => {
  window.addEventListener('pointerup', resetReordering);
  window.addEventListener('touchend', resetReordering);
  window.addEventListener('mouseup', resetReordering);
  await fetchRoutingGroupInformation();
});

onUnmounted(() => {
  window.removeEventListener('pointerup', resetReordering);
  window.removeEventListener('touchend', resetReordering);
  window.removeEventListener('mouseup', resetReordering);
});

function resetReordering() {
  isReordering.value = false;
}

watch(routingGroupId, async () => {
  await fetchRoutingGroupInformation();
});

async function fetchRoutingGroupInformation() {
  if (!routingGroupId.value || "") {
    // Reset all state when no routing group is selected
    group.value = {};
    originalGroup.value = {};
    activeRoutingId.value = '';
    activeRuleId.value = '';
    activeRouting.value = null;
    activeRule.value = null;
    inventoryRules.value = [];
    rulesForReorder.value = [];
    hasUnsavedChanges.value = false
    return;
  }

  emitter.emit("presentLoader", { message: translate("Fetching information"), backdropDismiss: false })
  try {
    const resp = await OrderRoutingService.fetchRoutingGroup(routingGroupId.value || "");
    if(!hasError(resp) && resp.data) {
      group.value = normalizeGroupForUi(resp.data)
      originalGroup.value = deepClone(group.value)
      groupName.value = group.value.groupName || ""
      
      // Fetching schedule and history
      await Promise.all([
        fetchGroupSchedule(),
        fetchGroupHistory()
      ])

      if(group.value.routings?.length) {
        // Auto select first routing
        const firstRouting = getActiveAndDraftRoutings()[0]
        if (firstRouting) selectRouting(firstRouting);
      }
      hasUnsavedChanges.value = false
    }
  } catch(err) {
    logger.error(err);
  }
  emitter.emit("dismissLoader")
}

function syncActiveRuleDraft() {
  if (!activeRule.value?.routingRuleId) return;

  const currentRule = inventoryRules.value.find((rule: any) => rule.routingRuleId === activeRule.value.routingRuleId)
  if (!currentRule) return;

  currentRule.ruleName = activeRule.value.ruleName
  currentRule.statusId = activeRule.value.statusId
  currentRule.assignmentEnumId = activeRule.value.assignmentEnumId
  currentRule.inventoryFilters = {
    ENTCT_FILTER: deepClone(inventoryRuleFilterOptions.value || {}),
    ENTCT_SORT_BY: deepClone(inventoryRuleSortOptions.value || {})
  }
  currentRule.actions = deepClone(inventoryRuleActions.value || {})

  activeRule.value = currentRule
}

function syncActiveRoutingDraft() {
  if (!activeRouting.value) return;

  syncActiveRuleDraft();
  activeRouting.value.orderFilters = [
    ...toArrayMap(orderRoutingFilterOptions.value, true),
    ...toArrayMap(orderRoutingSortOptions.value, true)
  ].map((condition: any) => toBackendCondition(condition))
  activeRouting.value.rules = deepClone(inventoryRules.value || [])
  activeRouting.value.filtersCount = activeRouting.value.orderFilters.filter((condition: any) => condition.conditionTypeEnumId === "ENTCT_FILTER").length
  activeRouting.value.sortCount = activeRouting.value.orderFilters.filter((condition: any) => condition.conditionTypeEnumId === "ENTCT_SORT_BY").length
}

const selectRouting = (routing: any) => {
  syncActiveRoutingDraft();
  activeRoutingId.value = routing.orderRoutingId;
  activeRouting.value = routing;
  activeRuleId.value = '';
  activeRule.value = null;
  
  routeName.value = routing.routingName || ""
  isRouteNameUpdating.value = false

  initializeOrderRoutingOptions();
  
  inventoryRules.value = routing.rules ? JSON.parse(JSON.stringify(routing.rules)) : [];
  initializeInventoryRules();

  if (rulesForReorder.value?.length) {
    selectRule(rulesForReorder.value[0]);
  }
};

const selectRule = async (rule: any) => {
  syncActiveRuleDraft();
  activeRuleId.value = rule.routingRuleId;
  activeRule.value = inventoryRules.value.find((currentRule: any) => currentRule.routingRuleId === rule.routingRuleId) || rule
  initializeInventoryRule(activeRule.value);
};

function initializeInventoryRule(rule: any) {
  const inventoryRuleFilters = rule["inventoryFilters"] ? rule["inventoryFilters"] : {}

  inventoryRuleActions.value = rule["actions"] || {}
  inventoryRuleFilterOptions.value = inventoryRuleFilters["ENTCT_FILTER"] ? inventoryRuleFilters["ENTCT_FILTER"] : {}
  inventoryRuleSortOptions.value = inventoryRuleFilters["ENTCT_SORT_BY"] ? inventoryRuleFilters["ENTCT_SORT_BY"] : {}

  const actionTypes = ["ORA_NEXT_RULE", "ORA_MV_TO_QUEUE"]
  ruleActionType.value = Object.keys(inventoryRuleActions.value).find((actionId: string) => {
    return actionTypes.includes(actionId)
  }) || ""
}

function initializeInventoryRules() {
  rulesForReorder.value = sortSequence(JSON.parse(JSON.stringify(getActiveAndDraftOrderRules())))
}

function getActiveAndDraftOrderRules() {
  return inventoryRules.value.filter((rule: Rule) => rule.statusId !== "RULE_ARCHIVED")
}

function getArchivedOrderRules() {
  return inventoryRules.value.filter((rule: Rule) => rule.statusId === "RULE_ARCHIVED")
}

function getActiveAndDraftRoutings() {
  return (group.value.routings || []).filter((routing: any) => routing.statusId !== "ROUTING_ARCHIVED")
}

function getArchivedOrderRoutings() {
  return group.value.routings?.filter((routing: any) => routing.statusId === "ROUTING_ARCHIVED") || []
}

function getLabel(parentType: string, code: string) {
  const enumerations = enums.value[parentType]
  const enumInfo: any = enumerations ? Object.values(enumerations).find((enumeration: any) => enumeration.enumCode === code) : null

  return enumInfo?.description
}

function getRuleIndex() {
  const total = rulesForReorder.value.length
  const currentRuleIndex: any = Object.keys(rulesForReorder.value).find((key: any) => rulesForReorder.value[key].routingRuleId == activeRule.value?.routingRuleId)

  return `${+currentRuleIndex + 1}/${total}`
}

async function fetchGroupSchedule() {
  try {
    const resp = await OrderRoutingService.fetchRoutingScheduleInformation(routingGroupId.value || "");
    if (!hasError(resp) && resp.data?.schedule) {
      job.value = resp.data.schedule
    }
  } catch (err) {
    logger.error(err);
  }
}

async function fetchGroupHistory() {
  groupHistory.value = []
  if (!group.value?.jobName) return;

  try {
    const resp = await OrderRoutingService.fetchGroupHistory(group.value.jobName, { orderByField: "startTime DESC" })
    if (!hasError(resp)) {
      groupHistory.value = resp.data.sort((a: any, b: any) => b.startTime - a.startTime)
    }
  } catch (err) {
    logger.error(err)
  }
}

async function editGroupName() {
  isGroupNameUpdating.value = !isGroupNameUpdating.value;
  await nextTick()
  groupNameRef.value.$el.setFocus();
}

async function updateGroupName() {
  if (groupName.value.trim() && groupName.value.trim() !== (group.value.groupName || "").trim()) {
    group.value.groupName = groupName.value.trim()
    hasUnsavedChanges.value = true
  } else {
    groupName.value = (group.value.groupName || "").trim()
  }
  isGroupNameUpdating.value = false
}

async function cloneGroup() {
  if (!group.value) return;

  syncActiveRoutingDraft();

  const clonedGroup = deepClone(group.value)
  clonedGroup.routingGroupId = undefined
  clonedGroup.groupName = `${group.value.groupName || translate("Routing group")} copy`
  clonedGroup.createdDate = DateTime.now().toMillis()
  clonedGroup.lastUpdatedStamp = undefined
  clonedGroup.jobName = undefined
  clonedGroup.routings = (group.value.routings || []).map((routing: any, index: number) => {
    const clonedRouting = buildDraftRoutingClone(routing, false)
    clonedRouting.sequenceNum = index * 5
    return clonedRouting
  })

  group.value = clonedGroup
  originalGroup.value = {}
  groupName.value = clonedGroup.groupName
  hasUnsavedChanges.value = true

  activeRoutingId.value = ''
  activeRuleId.value = ''
  activeRouting.value = null
  activeRule.value = null
  inventoryRules.value = []
  rulesForReorder.value = []

  if (group.value.routings?.length) {
    const firstRouting = getActiveAndDraftRoutings()[0]
    if (firstRouting) selectRouting(firstRouting)
  }

  showToast(translate("Brokering run cloned"))
}

async function openScheduleModal() {
  const scheduleModal = await modalController.create({
    component: ScheduleModal,
    componentProps: { cronExpression: job.value.cronExpression }
  })

  scheduleModal.onDidDismiss().then(async (result: any) => {
    if (result?.data?.expression) {
      job.value.cronExpression = result.data.expression
      await saveSchedule()
    }
  })

  scheduleModal.present();
}

async function saveSchedule() {
  if (!job.value.cronExpression) {
    showToast(translate("Please select a scheduling for job"))
    return;
  }

  const payload = {
    routingGroupId: routingGroupId.value || "",
    paused: job.value.paused || 'N',
    ...job.value
  }

  try {
    const resp = await OrderRoutingService.scheduleBrokering(payload)
    if (!hasError(resp)) {
      showToast(translate("Job updated"))
      await fetchGroupSchedule()
    }
  } catch (err) {
    showToast(translate("Failed to update job"))
    logger.error(err)
  }
}

async function updateGroupStatus(event: CustomEvent) {
  job.value.paused = event.detail.value

  const payload = {
    routingGroupId: routingGroupId.value || "",
    paused: job.value.paused,
    cronExpression: job.value.cronExpression || "0 0 0 * * ?"
  }

  try {
    const resp = await OrderRoutingService.scheduleBrokering(payload)
    if (!hasError(resp)) {
      job.value.cronExpression = job.value.cronExpression || "0 0 0 * * ?"
      showToast(translate("Group status updated"))
    }
  } catch (err) {
    showToast(translate("Failed to update group status"))
    logger.error(err)
  }
}

async function runNow() {
  const scheduleAlert = await alertController.create({
    header: translate("Run now"),
    message: translate("Running this schedule now will not replace this schedule. A copy of this schedule will be created and run immediately. You may not be able to reverse this action."),
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      {
        text: translate("Run now"),
        handler: async () => {
          if (!job.value.jobName) {
            const payload = {
              routingGroupId: routingGroupId.value || "",
              paused: "Y",
            }
            try {
              const resp = await OrderRoutingService.scheduleBrokering(payload)
              if (!hasError(resp)) job.value.jobName = resp.data.jobName
            } catch (err) {
              logger.error(err)
              return;
            }
          }

          try {
            const resp = await OrderRoutingService.runNow(routingGroupId.value || "")
            if (!hasError(resp)) showToast(translate("Service has been scheduled"))
          } catch (err) {
            showToast(translate("Failed to schedule service"))
            logger.error(err)
          }
        }
      }
    ]
  });
  return scheduleAlert.present();
}

function timeTillJob(time: any) {
  if (!time) return;
  const timeDiff = DateTime.fromMillis(time).diff(DateTime.local());
  return DateTime.local().plus(timeDiff).toRelative();
}

function getCronString() {
  try {
    return job.value.cronExpression ? cronstrue.toString(job.value.cronExpression) : ""
  } catch (e) {
    logger.error(e)
    return ""
  }
}

async function showGroupHistory() {
  await fetchGroupHistory()
  const historyModal = await modalController.create({
    component: GroupHistoryModal,
    componentProps: { groupHistory: groupHistory.value }
  })
  historyModal.present();
}

function getRouteIndex() {
  const activeAndDraftRoute = group.value["routings"]?.filter((routing: any) => routing.statusId !== "ROUTING_ARCHIVED")
  if (!activeAndDraftRoute) return '0/0'
  const total = activeAndDraftRoute.length
  const currentRouteIndex: any = Object.keys(activeAndDraftRoute).find((key: any) => activeAndDraftRoute[key].orderRoutingId === activeRoutingId.value)

  return `${+currentRouteIndex + 1}/${total}`
}

function updateRuleStatus(event: CustomEvent, routingRuleId: string) {
  inventoryRules.value.map((inventoryRule: any) => {
    if(inventoryRule.routingRuleId === routingRuleId) {
      inventoryRule.statusId = event.detail.value
    }
  })

  if(event.detail.value === "RULE_ARCHIVED") {
    activeRule.value = null
  }

  hasUnsavedChanges.value = true
  initializeInventoryRules()
}

async function editRuleName() {
  isRuleNameUpdating.value = !isRuleNameUpdating.value;
  await nextTick()
  ruleNameRef.value.$el.setFocus();
}

async function updateRuleName(routingRuleId: string) {
  if (activeRule.value.ruleName.trim()) {
    const currentRule = inventoryRules.value.find((rule: any) => rule.routingRuleId === routingRuleId)
    if (currentRule) {
      currentRule.ruleName = activeRule.value.ruleName.trim()
      hasUnsavedChanges.value = true
    }
  }
  isRuleNameUpdating.value = false
}


function updateRuleFilterValue(event: any, fieldName: string, operator = "") {
  const filters = JSON.parse(JSON.stringify(inventoryRuleFilterOptions.value))
  const filter = filters[conditionFilterEnums[fieldName].code]
  const fieldValue = event.detail.value

  if (filter) {
    filter.fieldValue = fieldValue
    if (operator) filter.operator = operator
  } else {
    const code = conditionFilterEnums[fieldName].code
    const defaultOperator = code.endsWith("_excluded") ? "not-equals" : "equals"
    filters[conditionFilterEnums[fieldName].code] = {
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: code,
      fieldValue,
      operator: operator || defaultOperator,
      sequenceNum: Object.keys(filters).length + 1
    }
  }
  inventoryRuleFilterOptions.value = filters
  hasUnsavedChanges.value = true
}

function updateOperator(event: any) {
  const filters = JSON.parse(JSON.stringify(inventoryRuleFilterOptions.value))
  const filter = filters[conditionFilterEnums["BRK_SAFETY_STOCK"].code]

  if (filter) {
    filter.operator = event.detail.value
  }
  inventoryRuleFilterOptions.value = filters
  hasUnsavedChanges.value = true
}

function updatePartialAllocation(checked: boolean) {
  activeRule.value.assignmentEnumId = checked ? 'ORA_MULTI' : 'ORA_SINGLE'
  hasUnsavedChanges.value = true
}

function updatePartialGroupItemsAllocation(checked: boolean) {
  const filters = JSON.parse(JSON.stringify(inventoryRuleFilterOptions.value))
  const filter = filters[conditionFilterEnums["SPLIT_ITEM_GROUP"].code]
  const fieldValue = checked ? 'Y' : 'N'

  if (filter) {
    filter.fieldValue = fieldValue
  } else {
    filters[conditionFilterEnums["SPLIT_ITEM_GROUP"].code] = {
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: conditionFilterEnums["SPLIT_ITEM_GROUP"].code,
      fieldValue,
      operator: "equals",
      sequenceNum: Object.keys(filters).length + 1
    }
  }
  inventoryRuleFilterOptions.value = filters
  hasUnsavedChanges.value = true
}

function updateUnfillableActionType(id: string) {
  const actions = JSON.parse(JSON.stringify(inventoryRuleActions.value))
  
  // Remove existing movement actions
  delete actions["ORA_NEXT_RULE"]
  delete actions["ORA_MV_TO_QUEUE"]

  actions[id] = {
    actionTypeEnumId: id,
    routingActionTypeId: id,
    actionValue: ""
  }
  
  inventoryRuleActions.value = actions
  ruleActionType.value = id
  hasUnsavedChanges.value = true
}

function updateRuleActionValue(value: string) {
  const actions = JSON.parse(JSON.stringify(inventoryRuleActions.value))
  if (actions[ruleActionType.value]) {
    actions[ruleActionType.value].actionValue = value
  }
  inventoryRuleActions.value = actions
  hasUnsavedChanges.value = true
}

function clearAutoCancelDays(checked: boolean) {
  const actions = JSON.parse(JSON.stringify(inventoryRuleActions.value))
  const rmActionId = actionEnums['RM_AUTO_CANCEL_DATE'].id
  const autoCancelActionId = actionEnums['AUTO_CANCEL_DAYS'].id

  actions[rmActionId] = {
    actionTypeEnumId: rmActionId,
    routingActionTypeId: rmActionId,
    actionValue: checked ? "true" : "false"
  }

  if (checked) {
    delete actions[autoCancelActionId]
  }

  inventoryRuleActions.value = actions
  hasUnsavedChanges.value = true
}

async function updateAutoCancelDays() {
  const alert = await alertController.create({
    header: translate("Auto cancel days"),
    inputs: [{
      name: "actionValue",
      type: "number",
      value: inventoryRuleActions.value[actionEnums['AUTO_CANCEL_DAYS'].id]?.actionValue
    }],
    buttons: [{
      text: translate("Cancel"),
      role: "cancel"
    }, {
      text: translate("Save"),
      handler: (data) => {
        const actions = JSON.parse(JSON.stringify(inventoryRuleActions.value))
        const actionId = actionEnums['AUTO_CANCEL_DAYS'].id
        actions[actionId] = {
          actionTypeEnumId: actionId,
          routingActionTypeId: actionId,
          actionValue: data.actionValue
        }
        inventoryRuleActions.value = actions
        hasUnsavedChanges.value = true
      }
    }]
  });

  await alert.present();
}

function removeAutoCancelDays() {
  const actions = JSON.parse(JSON.stringify(inventoryRuleActions.value))
  delete actions[actionEnums['AUTO_CANCEL_DAYS'].id]
  inventoryRuleActions.value = actions
  hasUnsavedChanges.value = true
}

function doConditionSortReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(Object.values(inventoryRuleSortOptions.value)))
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(Object.values(inventoryRuleSortOptions.value))));
  const updatedSeqenceNum = previousSeq.map((filter: any) => filter.sequenceNum).sort((a: any, b: any) => a - b)
  
  updatedSeq.map((filter: any, index: number) => {
    filter.sequenceNum = updatedSeqenceNum[index]
  })

  inventoryRuleSortOptions.value = updatedSeq.reduce((filters: any, filter: any) => {
    filters[filter.fieldName] = filter
    return filters
  }, {})
  hasUnsavedChanges.value = true
  isReordering.value = false
}

async function addInventoryFilterOptions(parentEnumId: string, conditionTypeEnumId: string, label = "") {
  if (!activeRule.value?.routingRuleId) {
    showToast(translate("Please select a rule first"));
    return;
  }
  const modal = await modalController.create({
    component: AddInventoryFilterOptionsModal,
    componentProps: {
      ruleConditions: conditionTypeEnumId === "ENTCT_FILTER" ? inventoryRuleFilterOptions.value : inventoryRuleSortOptions.value,
      routingRuleId: activeRule.value.routingRuleId,
      parentEnumId,
      conditionTypeEnumId,
      label,
      filterOptions: inventoryRuleFilterOptions.value
    }
  });

  modal.onDidDismiss().then((result: any) => {
    if (result.role === "save") {
      if (conditionTypeEnumId === "ENTCT_FILTER") {
        inventoryRuleFilterOptions.value = result.data.filters
      } else {
        inventoryRuleSortOptions.value = result.data.filters
      }
      hasUnsavedChanges.value = true
    }
  });

  await modal.present();
}

async function addInventoryRule() {
  const newRuleAlert = await alertController.create({
    header: translate("New Inventory Rule"),
    buttons: [{
      text: translate("Cancel"),
      role: "cancel"
    }, {
      text: translate("Save"),
      handler: (data) => {
        if(!data.ruleName?.trim().length) {
          showToast(translate("Please enter a valid name"))
          return false;
        }
      }
    }],
    inputs: [{
      name: "ruleName",
      placeholder: translate("Rule name")
    }]
  })

  newRuleAlert.onDidDismiss().then(async (result: any) => {
    const ruleName = result.data?.values?.ruleName;
    if(!result.role && ruleName) {
      const newRule = normalizeRuleForUi({
        routingRuleId: `${TEMP_ID_PREFIX}${DateTime.now().toMillis()}`,
        ruleName,
        statusId: "RULE_DRAFT",
        sequenceNum: inventoryRules.value.length && inventoryRules.value[inventoryRules.value.length - 1].sequenceNum >= 0 ? inventoryRules.value[inventoryRules.value.length - 1].sequenceNum + 5 : 0,
        assignmentEnumId: "ORA_SINGLE",
        createdDate: DateTime.now().toMillis(),
        inventoryFilters: [],
        actions: [{
          actionTypeEnumId: "ORA_NEXT_RULE",
          actionValue: "",
          createdDate: DateTime.now().toMillis()
        }]
      })
      inventoryRules.value.push(newRule)
      initializeInventoryRules()
      hasUnsavedChanges.value = true
      const currentRule = rulesForReorder.value.find((rule: any) => rule.routingRuleId === newRule.routingRuleId)
      if (currentRule) {
        selectRule(currentRule)
      }
    }
  })

  await newRuleAlert.present();
}

async function openArchivedRuleModal() {
  const archivedRuleModal = await modalController.create({
    component: ArchivedRuleModal,
    componentProps: { archivedRules: getArchivedOrderRules() }
  })

  await archivedRuleModal.present();
}

function findRemovedOrderFilters(originalGroupData: any, draftGroupData: any) {
  const removedByRouting = {} as any

  const draftRoutingsById = (draftGroupData.routings || []).reduce((routings: any, routing: any) => {
    if (routing.orderRoutingId) routings[routing.orderRoutingId] = routing
    return routings
  }, {})

  for (const originalRouting of (originalGroupData.routings || [])) {
    if (!originalRouting.orderRoutingId) continue
    const draftRouting = draftRoutingsById[originalRouting.orderRoutingId]
    if (!draftRouting) continue

    const draftConditionIds = new Set((draftRouting.orderFilters || []).map((condition: any) => condition.conditionSeqId).filter(Boolean))
    const removedConditions = (originalRouting.orderFilters || []).filter((condition: any) => condition.conditionSeqId && !draftConditionIds.has(condition.conditionSeqId))

    if (removedConditions.length) {
      removedByRouting[originalRouting.orderRoutingId] = removedConditions
    }
  }

  return removedByRouting
}

function findRemovedRuleDetails(originalGroupData: any, draftGroupData: any) {
  const removedConditionsByRule = {} as any
  const removedActionsByRule = {} as any

  const draftRulesById = (draftGroupData.routings || []).reduce((rulesById: any, routing: any) => {
    for (const rule of (routing.rules || [])) {
      if (rule.routingRuleId) rulesById[rule.routingRuleId] = rule
    }
    return rulesById
  }, {})

  for (const originalRouting of (originalGroupData.routings || [])) {
    for (const originalRule of (originalRouting.rules || [])) {
      if (!originalRule.routingRuleId) continue
      const draftRule = draftRulesById[originalRule.routingRuleId]
      if (!draftRule) continue

      const draftConditionIds = new Set((draftRule.inventoryFilters || []).map((condition: any) => condition.conditionSeqId).filter(Boolean))
      const removedConditions = (originalRule.inventoryFilters || []).filter((condition: any) => condition.conditionSeqId && !draftConditionIds.has(condition.conditionSeqId))
      if (removedConditions.length) {
        removedConditionsByRule[originalRule.routingRuleId] = removedConditions
      }

      const draftActionIds = new Set((draftRule.actions || []).map((action: any) => action.actionSeqId).filter(Boolean))
      const removedActions = (originalRule.actions || []).filter((action: any) => action.actionSeqId && !draftActionIds.has(action.actionSeqId))
      if (removedActions.length) {
        removedActionsByRule[originalRule.routingRuleId] = removedActions
      }
    }
  }

  return { removedConditionsByRule, removedActionsByRule }
}

async function deleteRemovedDetails(originalSerializedGroup: any, draftSerializedGroup: any) {
  const removedOrderFilters = findRemovedOrderFilters(originalSerializedGroup, draftSerializedGroup)
  const { removedConditionsByRule, removedActionsByRule } = findRemovedRuleDetails(originalSerializedGroup, draftSerializedGroup)

  for (const [orderRoutingId, filters] of Object.entries(removedOrderFilters)) {
    await store.dispatch("orderRouting/deleteRoutingFilters", { orderRoutingId, filters })
  }

  for (const [routingRuleId, conditions] of Object.entries(removedConditionsByRule)) {
    await store.dispatch("orderRouting/deleteRuleConditions", { routingRuleId, conditions })
  }

  for (const [routingRuleId, actions] of Object.entries(removedActionsByRule)) {
    await store.dispatch("orderRouting/deleteRuleActions", { routingRuleId, actions })
  }
}

async function save() {
  syncActiveRoutingDraft();
  group.value.groupName = groupName.value?.trim() || group.value.groupName

  emitter.emit("presentLoader", { message: "Updating inventory rules and filters", backdropDismiss: false })
  try {
    const serializedDraft = toSerializableGroup(group.value)
    const serializedOriginal = toSerializableGroup(originalGroup.value)
    let savedGroupId = group.value.routingGroupId

    if (group.value.routingGroupId) {
      const updateResp = await OrderRoutingService.updateRoutingGroup(serializedDraft)
      if (hasError(updateResp)) throw updateResp
      await deleteRemovedDetails(serializedOriginal, serializedDraft)
    } else {
      const createResp = await OrderRoutingService.createRoutingGroup(serializedDraft)
      if (hasError(createResp)) throw createResp
      savedGroupId = createResp?.data?.routingGroupId
    }

    if (savedGroupId) {
      const latestGroupResp = await OrderRoutingService.fetchRoutingGroup(savedGroupId)
      if (hasError(latestGroupResp) || !latestGroupResp.data) throw latestGroupResp

      group.value = normalizeGroupForUi(latestGroupResp.data)
      originalGroup.value = deepClone(group.value)
      groupName.value = group.value.groupName || ""
      if (group.value.routings?.length) {
        const firstRouting = getActiveAndDraftRoutings()[0]
        if (firstRouting) selectRouting(firstRouting);
      } else {
        activeRoutingId.value = ''
        activeRuleId.value = ''
        activeRouting.value = null
        activeRule.value = null
      }
      await Promise.all([
        fetchGroupSchedule(),
        fetchGroupHistory()
      ])
    } else {
      // Keep local state if backend does not return the new ID in create response.
      originalGroup.value = deepClone(group.value)
    }

    hasUnsavedChanges.value = false
    showToast(translate("Changes saved successfully"))
  } catch (error) {
    logger.error(error)
    showToast(translate("Failed to save changes"))
  } finally {
    emitter.emit("dismissLoader")
  }
}

function initializeOrderRoutingOptions() {
  if (!activeRouting.value?.orderFilters) {
    orderRoutingFilterOptions.value = {};
    orderRoutingSortOptions.value = {};
    return;
  }

  const orderRouteFilters = sortSequence(JSON.parse(JSON.stringify(activeRouting.value.orderFilters))).reduce((filters: any, filter: any) => {
    const fieldName = getUiFieldName(filter)
    const updatedFilter = { ...filter, fieldName }
    if(filters[filter.conditionTypeEnumId]) {
      filters[filter.conditionTypeEnumId][fieldName] = updatedFilter
    } else {
      filters[filter.conditionTypeEnumId] = {
        [fieldName]: updatedFilter
      }
    }
    return filters
  }, {})

  orderRoutingFilterOptions.value = orderRouteFilters["ENTCT_FILTER"] ? orderRouteFilters["ENTCT_FILTER"] : {}
  orderRoutingSortOptions.value = orderRouteFilters["ENTCT_SORT_BY"] ? orderRouteFilters["ENTCT_SORT_BY"] : {}
}

function getFilterValue(options: any, enums: any, parameter: string) {
  return enums[parameter] ? options?.[enums[parameter].code] : undefined
}

function getSelectedValue(options: any, enumerations: any, parameter: string) {
  let value = options?.[enumerations[parameter].code].fieldValue

  if(!value) {
    return "";
  }

  value = value?.split(',')

  if(value?.length > 1) {
    return `${value.length} ${translate("selected")}`
  } else {
    const selectedId = String(value[0]);
    return parameter === "SHIPPING_METHOD" || parameter === "SHIPPING_METHOD_EXCLUDED" ? shippingMethods.value[selectedId]?.description || selectedId : parameter === "SALES_CHANNEL" || parameter === "SALES_CHANNEL_EXCLUDED" ? enums.value["ORDER_SALES_CHANNEL"] ? enums.value["ORDER_SALES_CHANNEL"][selectedId]?.description : selectedId : parameter === "ORIGIN_FACILITY_GROUP" || parameter === "ORIGIN_FACILITY_GROUP_EXCLUDED" || parameter === "FACILITY_GROUP" || parameter === "FACILITY_GROUP_EXCLUDED" ? facilityGroups.value[selectedId]?.facilityGroupName || selectedId : facilities.value[selectedId]?.facilityName || selectedId
  }
}



async function editRouteName() {
  isRouteNameUpdating.value = !isRouteNameUpdating.value;
  await nextTick()
  routeNameRef.value.$el.setFocus();
}

async function updateRouteName() {
  if(routeName.value.trim() && routeName.value.trim() !== (activeRouting.value.routingName || "").trim()) {
    activeRouting.value.routingName = routeName.value.trim()
    hasUnsavedChanges.value = true
  }
  isRouteNameUpdating.value = false
}

async function cloneRouting(routing: any) {
  if (!routing) return;

  syncActiveRoutingDraft();

  const clonedRouting = buildDraftRoutingClone(routing, true)
  clonedRouting.sequenceNum = group.value.routings?.length ? Math.max(...group.value.routings.map((route: any) => route.sequenceNum || 0)) + 5 : 0

  group.value.routings.push(clonedRouting)
  group.value.routings = sortSequence(group.value.routings)
  hasUnsavedChanges.value = true
  selectRouting(clonedRouting)
  showToast(translate("Route cloned successfully"))
}

async function updateRoutingStatus(statusId: string) {
  activeRouting.value.statusId = statusId
  hasUnsavedChanges.value = true
}

function updateOrderFilterValue(event: CustomEvent, fieldName: string, multi = false) {
  const enumConfig = ruleEnums[fieldName as keyof typeof ruleEnums]
  const backendFieldName = enumConfig ? enumConfig.code : fieldName
  const value = multi ? event.detail.value.join(",") : event.detail.value
  const filter = orderRoutingFilterOptions.value[backendFieldName]
  if(filter) {
    filter.fieldValue = value
  } else {
    orderRoutingFilterOptions.value[backendFieldName] = {
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: backendFieldName,
      fieldValue: value,
      operator: "equals"
    }
  }

  if (backendFieldName.endsWith("_excluded")) {
    orderRoutingFilterOptions.value[backendFieldName].operator = multi ? "not-in" : "not-equals"
  }
  hasUnsavedChanges.value = true
}

function doRouteSortReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(Object.values(orderRoutingSortOptions.value)))
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(Object.values(orderRoutingSortOptions.value))));
  const updatedSeqenceNum = previousSeq.map((filter: any) => filter.sequenceNum).sort((a: any, b: any) => a - b)
  
  updatedSeq.map((filter: any, index: number) => {
    filter.sequenceNum = updatedSeqenceNum[index]
  })

  orderRoutingSortOptions.value = updatedSeq.reduce((filters: any, filter: any) => {
    filters[filter.fieldName] = filter
    return filters
  }, {})
  hasUnsavedChanges.value = true
  isReordering.value = false
}

function doRoutingReorder(event: CustomEvent) {
  const visibleRoutings = JSON.parse(JSON.stringify(getActiveAndDraftRoutings()))
  const updatedVisibleRoutings = event.detail.complete(JSON.parse(JSON.stringify(visibleRoutings)));

  const updatedSequenceNum = visibleRoutings.map((routing: any) => routing.sequenceNum)
  Object.keys(updatedVisibleRoutings).map((key: any, index: number) => {
    updatedVisibleRoutings[key].sequenceNum = updatedSequenceNum[index]
  })

  group.value.routings = [
    ...updatedVisibleRoutings,
    ...getArchivedOrderRoutings()
  ]
  hasUnsavedChanges.value = true
  isReordering.value = false
}

async function addOrderRouteFilterOptions(parentEnumId: string, conditionTypeEnumId: string, label = "") {
  if (!activeRouting.value?.orderRoutingId) {
    showToast(translate("Please select a routing first"));
    return;
  }
  const orderRouteFilterOptionsModal = await modalController.create({
    component: AddOrderRouteFilterOptions,
    componentProps: { 
      orderRoutingFilters: conditionTypeEnumId === "ENTCT_FILTER" ? orderRoutingFilterOptions.value : orderRoutingSortOptions.value, 
      orderRoutingId: activeRouting.value.orderRoutingId, 
      parentEnumId, 
      conditionTypeEnumId, 
      label 
    }
  })

  orderRouteFilterOptionsModal.onDidDismiss().then((result: any) => {
    if(result.role === "save") {
      conditionTypeEnumId === "ENTCT_FILTER" ? ( orderRoutingFilterOptions.value = result.data.filters ) : ( orderRoutingSortOptions.value = result.data.filters )
      hasUnsavedChanges.value = true
    }
  })

  await orderRouteFilterOptionsModal.present();
}

function getInventoryRules(ruleId: string) {
  // In the context of Circuit, we might want to show actions or other related rules
  // For now, let's just return an empty array if not implemented, or use activeRule info
  if (activeRule.value && activeRule.value.routingRuleId === ruleId) {
    // If we have inventory rules within the rule, we could return them.
    // Based on BrokeringQuery.vue, inventoryRules are separate.
    // For this UI, we'll just show the active rule as the "Inventory Rule" or related data
    return [activeRule.value];
  }
  return [];
}


function doReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(rulesForReorder.value))
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(rulesForReorder.value)));

  const updatedSeqenceNum = previousSeq.map((rule: any) => rule.sequenceNum)
  Object.keys(updatedSeq).map((key: any, index: number) => {
    updatedSeq[key].sequenceNum = updatedSeqenceNum[index]
  })

  rulesForReorder.value = updatedSeq
  
  // Update original inventoryRules to maintain state
  inventoryRules.value.map((rule: any) => {
    const updatedRule = updatedSeq.find((seq: any) => seq.routingRuleId === rule.routingRuleId)
    if(updatedRule) {
      rule.sequenceNum = updatedRule.sequenceNum
    }
  })
  hasUnsavedChanges.value = true
  isReordering.value = false
}
async function openRoutingHistoryModal(orderRoutingId: string, routingName: string) {
  await store.dispatch("orderRouting/fetchRoutingHistory", routingGroupId.value || "")
  const routingHistoryModal = await modalController.create({
    component: RoutingHistoryModal,
    componentProps: { routingHistory: routingHistory.value[orderRoutingId], routingName, groupName: group.value.groupName }
  })

  routingHistoryModal.present();
}

async function openArchivedRoutingModal() {
  const archivedRoutingModal = await modalController.create({
    component: ArchivedRoutingModal,
    componentProps: {
      archivedRoutings: group.value?.routings?.filter((routing: any) => routing.statusId === "ROUTING_ARCHIVED") || [],
      saveRoutings: (routings: any) => {
        if(Array.isArray(routings)) {
          group.value.routings = normalizeGroupForUi({ routings }).routings
          hasUnsavedChanges.value = true
        }
      }
    }
  })

  archivedRoutingModal.present();
}
</script>

<style scoped>

.circuit-canvas {
  display: grid;
  grid-template-columns: repeat(6, 350px);
  column-gap: var(--spacer-base);
  height: 100%;
  overflow-x: scroll;
}

ion-card {
  margin: 0;
}

/* assign columns */

.routing-group {
  grid-column: 1;
}

.routing {
  grid-column: 2/4;
}

.routing-rule {
  grid-column: 4/6;
}

/* routing group */
.routing-group {
  height: 100%;
  overflow-y: scroll;
  padding-block-end: var(--spacer-2xl);
}

.routing-group h2 {
  margin-inline: var(--spacer-sm);
}

.routing-group ion-card {
  margin: var(--spacer-sm);
  position: relative;
  overflow: hidden;
}

.info {
  display: flex;
  flex-direction: column;
}

.info > div {
  border-bottom: 1px solid var(--ion-color-light);
}

.info > div:last-child {
  border-bottom: none;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.name {
  background: var(--ion-color-light);
  border-radius: 8px;
  --padding-start: var(--spacer-xs);
}

/* summary */
.summary {
  margin: var(--spacer-sm);
  display: grid;
}

.summary .title {
  grid-column: 1;
}

.summary .actions {
  grid-column: 1;
  padding: var(--spacer-xs);
}

.summary .status {
  grid-column: 2;
}

.summary .history {
  grid-row: 1;
  grid-column: 2;
  align-self: end;
}

/* routing */
.routing .config {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.routing .config > section {
  margin: var(--spacer-sm);
}

.routing .config .condition {
  grid-column: 1;
}

.routing .config .rules {
  grid-column: 2;
}

/* routing rule */
.routing-rule .config {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacer-sm);
  padding: var(--spacer-sm);
  align-items: start;
}

.routing-rule .filter {
  grid-column: 1;
}

.routing-rule .sort {
  grid-column: 2;
}

.routing-rule .split {
  grid-column: 1;
}

.routing-rule .unavailable {
  grid-column: 1;
}

/* Empty State */
.empty-state-canvas {
  grid-template-columns: 350px 1fr;
}

.empty-state-content {
  grid-column: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacer-2xl);
}

.empty-content-wrapper {
  text-align: center;
  max-width: 500px;
}

.icon-container {
  margin-bottom: var(--spacer-xl);
}

.icon-container ion-icon {
  font-size: 120px;
  color: var(--ion-color-medium);
  opacity: 0.4;
}

.empty-content-wrapper h2 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: var(--spacer-base);
  color: var(--ion-color-dark);
}

.empty-content-wrapper .description {
  font-size: 16px;
  color: var(--ion-color-medium);
  margin-bottom: var(--spacer-2xl);
  line-height: 1.6;
}

.action-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacer-sm);
  padding: var(--spacer-lg);
  background: var(--ion-color-light);
  border-radius: 12px;
  margin-top: var(--spacer-xl);
}

.action-prompt ion-icon {
  font-size: 24px;
  color: var(--ion-color-primary);
}

.action-prompt p {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-color-dark);
}

</style>
