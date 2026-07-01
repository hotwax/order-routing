<template>
  <div class="circuit-canvas" v-if="group?.routingGroupId">
    <!-- Routing Group Column -->
    <div class="routing-group">
      <ion-card class="info">
        <div>
          <ion-card-header>
            <ion-card-title>{{ groupName }}</ion-card-title>
            <ion-card-subtitle>{{ sim.activeVariationId ? (group.variationGroupId || sim.activeVariationId) : group.routingGroupId }}</ion-card-subtitle>
          </ion-card-header>
          <div class="ion-padding variation-editing">
            <ion-chip :color="sim.activeVariationId ? 'primary' : 'medium'" :outline="true">
              <ion-label>
                <template v-if="sim.activeVariationId">{{ translate("Editing:") }} {{ sim.activeVariation?.label }}</template>
                <template v-else>{{ translate("New variation (from Baseline)") }}</template>
                <template v-if="sim.isDirty"> — {{ translate("unsaved changes") }}</template>
              </ion-label>
            </ion-chip>
            <div>
              <ion-button v-if="sim.activeVariationId" color="primary" size="small" @click="updateActiveVariation()">
                <ion-icon slot="start" :icon="saveOutline" />
                {{ translate("Update") }} {{ sim.activeVariation?.label }}
              </ion-button>
              <ion-button :fill="sim.activeVariationId ? 'outline' : 'solid'" color="primary" size="small" @click="saveAsNewVariation()">
                <ion-icon slot="start" :icon="addCircleOutline" />
                {{ translate("Save as new variation") }}
              </ion-button>
            </div>
          </div>
        </div>
        <div>
          <ion-item>
            <ion-label>{{ translate("Created at") }}</ion-label>
            <ion-label slot="end">{{ commonUtil.getDateAndTime(group.createdDate) }}</ion-label>
          </ion-item>
          <ion-item lines="none">
            <ion-label>{{ translate("Updated at") }}</ion-label>
            <ion-label slot="end">{{ commonUtil.getDateAndTime(group.lastUpdatedStamp) }}</ion-label>
          </ion-item>
        </div>
      </ion-card>

      <ion-list-header>
        <ion-label>{{ translate("Routings") }}</ion-label>
      </ion-list-header>
      <ion-list v-if="group.routings?.length">
      <ion-reorder-group @ionItemReorder="doRoutingReorder($event)" :disabled="false">
        <ion-card 
          v-for="(routing, index) in group.routings" 
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
            <ion-chip slot="end" v-if="group.routings">
              {{ (index as number) + 1 }}/{{ group.routings.length }}
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
              {{ getStatusDesc(routing.statusId) }}
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
        <p>{{ translate("This brokering run has no routings to simulate.") }}</p>
      </div>
    </div>

    <!-- Routing Column -->
    <div class="routing" v-if="activeRouting?.orderRoutingId">
      <ion-card class="summary">
        <ion-item class="title" lines="none">
          <ion-label>
            <p>{{ getRouteIndex() }}</p>
            {{ activeRouting?.routingName }}
          </ion-label>
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
              <ion-item class="rule-item" lines="full" v-for="rule in rulesForReorder" :key="ruleKey(rule)" :disabled="isReordering" :color="ruleKey(rule) === activeRuleId ? 'light' : ''" @click="selectRule(rule)" button>
                <ion-label>
                  {{ rule.ruleName }}
                  <p>
                    <ion-note :color="rule.statusId === 'RULE_ACTIVE' ? 'success' : rule.statusId === 'RULE_ARCHIVED' ? 'warning' : ''">{{ rule.statusId === "RULE_ACTIVE" ? translate("Active") : rule.statusId === "RULE_ARCHIVED" ? translate("Archived") : translate("Draft") }}</ion-note>
                  </p>
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
    <div class="routing-rule" v-if="activeRouting?.orderRoutingId">
      <div v-if="activeRule">
        <ion-card class="summary">
          <ion-item class="title" lines="none">
            <ion-label>
              <p>{{ getRuleIndex() }}</p>
              {{ selectedRoutingRule.ruleName }}
            </ion-label>
          </ion-item>
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
                {{ translate("Filters") }}
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
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in brokeringFacilityGroups" :key="facilityGroupId" :value="facilityGroupId" :disabled="isFacilityGroupSelected(facilityGroupId, 'included')">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED')">
              <ion-select :placeholder="translate('facility group')" interface="popover" :selected-text="getSelectedValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED') || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED').fieldValue" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED').fieldValue" @ionChange="updateRuleFilterValue($event, 'FACILITY_GROUP_EXCLUDED')">
                <div slot="label">
                  <ion-label>{{ translate("Group") }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in brokeringFacilityGroups" :key="facilityGroupId" :value="facilityGroupId" :disabled="isFacilityGroupSelected(facilityGroupId, 'excluded')">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
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
                {{ translate("Sort") }}
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
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonItemGroup,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRippleEffect,
  IonReorder,
  IonReorderGroup,
  IonSelect,
  IonSelectOption,
  IonToggle,
  modalController,
  alertController
} from '@ionic/vue';
import {
  filterOutline,
  swapVerticalOutline,
  closeCircleOutline,
  optionsOutline,
  addCircleOutline,
  pulseOutline,
  saveOutline,
  golfOutline,
  playForwardOutline,
  gitNetworkOutline,
  sparklesOutline
} from 'ionicons/icons';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { simulationStore } from "@/store/simulationStore";
import { productStore } from '@/store/productStore';
import { useUtilStore } from '@/store/utilStore';
import { translate, logger, commonUtil } from '@common';
import AddOrderRouteFilterOptions from "@/components/AddOrderRouteFilterOptions.vue"
import { Rule } from "@/types";
import AddInventoryFilterOptionsModal from "@/components/AddInventoryFilterOptionsModal.vue";
import ArchivedRoutingModal from "@/components/ArchivedRoutingModal.vue"
import ArchivedRuleModal from "@/components/ArchivedRuleModal.vue"
import { DateTime } from "luxon";
import { DraftAssistantService } from "@/services/DraftAssistantService";
import type { DraftConversationMessage, DraftProposal } from "@/types/draft";
import { buildBrokeringRulesBindings, buildBrokeringRulesManifest } from "@/utils/brokeringRulesManifest";
import { buildBrokeringAgentSnapshot } from "@/composables/useBrokeringAgentSnapshot";

// Simulation fork of CircuitCanvas: edits an in-memory working copy of the
// routing group (simulationStore.working) and performs NO network writes.
// "Save as variation" snapshots the working copy into the simulation store.
const sim = simulationStore();
const product = productStore();
const utilStore = useUtilStore();

const routingGroupId = computed(() => sim.routingGroupId || null);
const group = ref({}) as any;
const activeRoutingId = ref('');
const activeRuleId = ref('');
const activeRouting = ref(null) as any;
const initialActiveRouting = ref(null) as any;
const activeRule = ref(null) as any;

const orderRoutingFilterOptions = ref({}) as any;
const orderRoutingSortOptions = ref({}) as any;
const inventoryRules = ref([]) as any;
const rulesForReorder = ref([]) as any;
const inventoryRuleFilterOptions = ref({}) as any;
const inventoryRuleSortOptions = ref({}) as any;
const inventoryRuleActions = ref({}) as any;
const ruleActionType = ref("");
const rulesInformation = ref({}) as any;
const initialRulesInformation = ref({}) as any;
const actionEnums = JSON.parse(import.meta.env.VITE_RULE_ACTION_ENUMS as string || '{}');
const conditionFilterEnums = JSON.parse(import.meta.env.VITE_RULE_FILTER_ENUMS as string || '{}');
const conditionSortEnums = JSON.parse(import.meta.env.VITE_RULE_SORT_ENUMS as string || '{}');

const groupName = ref("");
const isReordering = ref(false);
// Retained as local-only edit tracking; in the simulation fork nothing persists,
// but the draft-assist binding layer and several edit handlers reference it.
const hasUnsavedChanges = ref(false);

const ruleEnums = JSON.parse(import.meta.env.VITE_RULE_ENUMS as string || '{}');

const facilities = computed(() => product.getVirtualFacilities);
const enums = computed(() => utilStore.getEnums);
const shippingMethods = computed(() => product.getShippingMethods);
const facilityGroups = computed(() => product.getFacilityGroups);
const brokeringFacilityGroups = computed(() => product.getFacilityGroups); // Assuming brokering uses same for now or similar

const operatorRef = ref()
const measurementRef = ref()

let tempIdCounter = 0;
function ruleKey(rule: any) {
  return rule?.routingRuleId || rule?._tempId || "";
}

// Flush every pending editor edit into the working copy before snapshotting it.
function flushWorking() {
  syncActiveRuleDraft();
  syncWorkingFromLocalState();
}

// Save the current working copy as a brand-new variation (prompts for a name).
async function saveAsNewVariation() {
  const alert = await alertController.create({
    header: translate("Save as new variation"),
    inputs: [{ name: "label", placeholder: translate("Variation name") }],
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      {
        text: translate("Save"),
        handler: async (data) => {
          flushWorking();
          const isSaved = await sim.saveAsVariation(data?.label);
          commonUtil.showToast(isSaved ? translate("Variation saved") : (sim.loadError || translate("Failed to save variation")));
        }
      }
    ]
  });
  await alert.present();
}

// Overwrite the variation currently being edited with the latest working copy.
async function updateActiveVariation() {
  if (!sim.activeVariationId) return;
  flushWorking();
  const isUpdated = await sim.updateVariation(sim.activeVariationId);
  commonUtil.showToast(isUpdated ? translate("Variation updated") : (sim.loadError || translate("Failed to update variation")));
}

const getStatusDesc = computed(() => (id: string) => utilStore.getStatusDesc(id))
const routingStatus = computed(() => activeRouting.value?.statusId)
const selectedRoutingRule = computed(() => activeRule.value || {})
const getRuleStatus = computed(() => (ruleId: string) => rulesForReorder.value.find((rule: any) => ruleKey(rule) == (ruleId || activeRuleId.value))?.statusId)

function isInventoryRuleFiltersApplied() {
  const ruleFilters = Object.keys(inventoryRuleFilterOptions.value).filter((rule: string) => rule !== conditionFilterEnums["SPLIT_ITEM_GROUP"]?.code);
  return ruleFilters.length
}

type CircuitDraftProposal = DraftProposal & {
  id: string;
  sourcePrompt: string;
  createdAt: number;
};

async function prepareCircuitDraftProposal(prompt: string, conversationHistory: DraftConversationMessage[] = []) {
  if (!activeRouting.value?.orderRoutingId) {
    return {
      proposal: null,
      message: translate("Select a routing context before asking Circuit to draft changes.")
    };
  }

  const manifest = await buildCircuitDraftManifest();
  const plan = await DraftAssistantService.requestBrokeringRouteDraftOperations(prompt, manifest, { conversationHistory });
  const proposal = DraftAssistantService.createDraftProposal(plan, manifest);
  const pendingProposal: CircuitDraftProposal | null = (proposal.operations.length || proposal.newRouting)
    ? {
      ...proposal,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sourcePrompt: prompt,
      createdAt: Date.now()
    }
    : null;

  if (proposal.intent === "inquiry") {
    return {
      proposal: null,
      message: formatInquiryMessage(proposal),
      intent: "inquiry" as const
    };
  }

  if (proposal.unansweredQuestions.length && !proposal.operations.length) {
    commonUtil.showToast(proposal.unansweredQuestions[0]);
    return {
      proposal: null,
      message: proposal.unansweredQuestions[0],
      intent: proposal.intent
    };
  }

  if (pendingProposal) {
    return {
      proposal: pendingProposal,
      message: formatDraftProposalMessage(pendingProposal, manifest),
      intent: proposal.intent
    };
  }

  return {
    proposal: null,
    message: proposal.summary || translate("No matching UI values found"),
    intent: proposal.intent
  };
}

async function applyCircuitDraftProposal(proposal: CircuitDraftProposal) {
  if (!activeRouting.value?.orderRoutingId) {
    return {
      appliedCount: 0,
      message: translate("Select a routing context before asking Circuit to draft changes.")
    };
  }

  const manifest = await buildCircuitDraftManifest();

  const result = await DraftAssistantService.applyDraftProposal(proposal, manifest, {
    // Creating brand-new routings is not a supported simulation edit (the diff engine
    // only captures changes to existing routings), and the fork performs no backend
    // writes — so this is a no-op in the simulation context.
    createSiblingRouting: async () => "",
    selectRouting: (id: string) => {
      const created = group.value.routings?.find((r: any) => r.orderRoutingId === id);
      if (created) selectRouting(created);
    },
    buildBindings: () => buildCircuitDraftBindings()
  });

  hasUnsavedChanges.value = true;

  const unansweredQuestions = [...(proposal.unansweredQuestions || []), ...result.unansweredQuestions];

  if (unansweredQuestions.length) {
    commonUtil.showToast(unansweredQuestions[0]);
    return {
      appliedCount: result.appliedCount,
      message: unansweredQuestions[0]
    };
  }

  return {
    appliedCount: result.appliedCount,
    message: proposal.summary || translate("No matching UI values found"),
    intent: proposal.intent
  };
}

function buildCircuitDraftBindings() {
  return buildBrokeringRulesBindings({
    orderRoutingId: activeRouting.value.orderRoutingId,
    selectedRoutingRule: getSelectedRuleDraftRef(),
    routingStatus: getRoutingStatusDraftRef(),
    orderRoutingFilterOptions,
    orderRoutingSortOptions,
    inventoryRuleFilterOptions,
    inventoryRuleSortOptions,
    inventoryRuleActions,
    inventoryRules,
    rulesInformation,
    rulesForReorder,
    ruleActionType,
    hasUnsavedChanges,
    ruleEnums,
    conditionFilterEnums,
    conditionSortEnums,
    actionEnums
  });
}

function formatDraftProposalMessage(proposal: CircuitDraftProposal, manifest: any) {
  const formattedSections = DraftAssistantService.formatDraftProposalSections(proposal.operations || [], manifest, proposal.newRouting);
  const summaryLines = formattedSections
    ? [formattedSections]
    : (proposal.summary || "")
      .split(";")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `- ${line}`);
  const questionLines = (proposal.unansweredQuestions || [])
    .map((question) => question.trim())
    .filter(Boolean)
    .map((question) => `- ${question}`);

  return [
    translate("Proposed draft changes:"),
    summaryLines.length ? summaryLines.join("\n") : `- ${proposal.providerSummary || translate("Draft updated")}`,
    questionLines.length ? `${translate("Open questions:")}\n${questionLines.join("\n")}` : "",
    translate("Review this proposal before it changes the routing screen. Send feedback to revise it, or apply it when ready.")
  ].filter(Boolean).join("\n\n");
}

function formatInquiryMessage(proposal: DraftProposal) {
  const questionLines = (proposal.unansweredQuestions || [])
    .map((question) => question.trim())
    .filter(Boolean)
    .map((question) => `- ${question}`);

  return [
    proposal.summary || proposal.providerSummary,
    questionLines.length ? `${translate("Open questions:")}\n${questionLines.join("\n")}` : ""
  ].filter(Boolean).join("\n\n");
}

async function buildCircuitDraftManifest() {
  await Promise.all([
    utilStore.fetchEnums({ productStoreId: group.value.productStoreId }),
    utilStore.fetchStatusInformation()
  ])
  return buildBrokeringRulesManifest({
    pageRoute: "/tabs/circuit",
    orderRoutingId: activeRouting.value?.orderRoutingId || "",
    routingName: activeRouting.value?.routingName || "",
    routingStatus: activeRouting.value?.statusId || "",
    brokeringRun: {
      routingGroupId: group.value.routingGroupId || routingGroupId.value || "",
      groupName: groupName.value || group.value.groupName || "",
      productStoreId: group.value.productStoreId || "",
      schedule: null,
      routings: (group.value?.routings || []).map((r: any) => ({
        orderRoutingId: r.orderRoutingId,
        routingName: r.routingName,
        statusId: r.statusId,
        sequenceNum: r.sequenceNum
      }))
    },
    selectedRoutingRule: activeRule.value || {},
    isTestEnabled: false,
    orderRoutingFilterOptions: orderRoutingFilterOptions.value,
    orderRoutingSortOptions: orderRoutingSortOptions.value,
    inventoryRuleFilterOptions: inventoryRuleFilterOptions.value,
    inventoryRuleSortOptions: inventoryRuleSortOptions.value,
    inventoryRuleActions: inventoryRuleActions.value,
    inventoryRules: inventoryRules.value,
    rulesInformation: rulesInformation.value,
    ruleActionType: ruleActionType.value,
    ruleEnums,
    conditionFilterEnums,
    conditionSortEnums,
    actionEnums,
    ...buildBrokeringAgentSnapshot()
  });
}

function getSelectedRuleDraftRef() {
  return {
    get value() {
      return activeRule.value || {};
    },
    set value(rule: any) {
      activeRule.value = rule;
    }
  };
}

function getRoutingStatusDraftRef() {
  return {
    get value() {
      return activeRouting.value?.statusId || "";
    },
    set value(statusId: string) {
      if (activeRouting.value) {
        activeRouting.value.statusId = statusId;
      }
    }
  };
}

defineExpose({
  prepareCircuitDraftProposal,
  applyCircuitDraftProposal
});

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

onMounted(async () => {
  window.addEventListener('pointerup', resetReordering);
  window.addEventListener('touchend', resetReordering);
  window.addEventListener('mouseup', resetReordering);
  await initializeFromWorking();
});

onUnmounted(() => {
  window.removeEventListener('pointerup', resetReordering);
  window.removeEventListener('touchend', resetReordering);
  window.removeEventListener('mouseup', resetReordering);
});

function resetReordering() {
  isReordering.value = false;
}

// React when the simulation store swaps the working copy (e.g. load variation /
// reset to baseline). Re-bind the local view to the new in-memory object.
watch(() => sim.working, async () => {
  await initializeFromWorking();
});

// Bind the editor to the in-memory simulation working copy. Performs NO group
// fetch — simulationStore.loadGroup already populated sim.working. Only read-only
// reference data (facilities / enums / statuses) is loaded so labels resolve.
async function initializeFromWorking() {
  if (!sim.working || !sim.working.routingGroupId) {
    group.value = {};
    activeRoutingId.value = '';
    activeRuleId.value = '';
    activeRouting.value = null;
    initialActiveRouting.value = null;
    activeRule.value = null;
    inventoryRules.value = [];
    rulesForReorder.value = [];
    return;
  }

  // Point the local group ref directly at sim.working so edits propagate.
  group.value = sim.working;
  groupName.value = group.value.groupName || "";

  try {
    await Promise.all([
      product.fetchRoutingReferenceData({ productStoreId: group.value.productStoreId }),
      utilStore.fetchStatusInformation()
    ]);
  } catch (err) {
    logger.error(err);
  }

  if (group.value.routings?.length) {
    selectRouting(group.value.routings[0]);
  }
}

// Normalize a rule/routing condition collection (the simulation working copy stores
// them as flat arrays) into the keyed-by-code option object the editor controls expect.
function buildOptionMap(conditions: any[] | undefined, conditionTypeEnumId: string) {
  return (conditions || [])
    .filter((c: any) => c.conditionTypeEnumId === conditionTypeEnumId)
    .reduce((map: any, c: any) => {
      map[c.fieldName] = { ...c };
      return map;
    }, {});
}

// Normalize an actions collection (array in working copy) into the keyed-by-action-type
// object the unavailable-items controls expect.
function buildActionMap(actions: any[] | undefined) {
  return (actions || []).reduce((map: any, a: any) => {
    const id = a.routingActionTypeId || a.actionTypeEnumId;
    if (id) map[id] = { ...a, routingActionTypeId: id };
    return map;
  }, {});
}

const selectRouting = (routing: any) => {
  syncActiveRuleDraft();
  // Flush the routing we're leaving back into the working copy before switching, so edits
  // across multiple routings all persist into the variation snapshot (not just the last one).
  syncWorkingFromLocalState();
  activeRoutingId.value = routing.orderRoutingId;
  activeRouting.value = routing;
  initialActiveRouting.value = JSON.parse(JSON.stringify(routing));
  activeRuleId.value = '';
  activeRule.value = null;
  rulesInformation.value = {};
  initialRulesInformation.value = {};

  initializeOrderRoutingOptions();

  inventoryRules.value = routing.rules ? JSON.parse(JSON.stringify(routing.rules)) : [];
  initializeInventoryRules();

  if (rulesForReorder.value?.length) {
    selectRule(rulesForReorder.value[0]);
  }
};

// Read rule details (actions + filters) directly from the in-memory working copy.
// No backend fetch — the simulation working group already holds the full hierarchy.
const selectRule = (rule: any) => {
  syncActiveRuleDraft();
  const key = ruleKey(rule);
  activeRuleId.value = key;
  if (!rulesInformation.value[key]) {
    rulesInformation.value[key] = JSON.parse(JSON.stringify(rule));
    initialRulesInformation.value[key] = JSON.parse(JSON.stringify(rule));
  }
  activeRule.value = rulesInformation.value[key];
  initializeInventoryRule(activeRule.value);
};

function initializeInventoryRule(rule: any) {
  const inventoryFilters = rule["inventoryFilters"];

  if (Array.isArray(inventoryFilters)) {
    // Working-copy shape: flat array of conditions.
    inventoryRuleFilterOptions.value = buildOptionMap(inventoryFilters, "ENTCT_FILTER");
    inventoryRuleSortOptions.value = buildOptionMap(inventoryFilters, "ENTCT_SORT_BY");
  } else {
    const filters = inventoryFilters || {};
    inventoryRuleFilterOptions.value = filters["ENTCT_FILTER"] ? filters["ENTCT_FILTER"] : {};
    inventoryRuleSortOptions.value = filters["ENTCT_SORT_BY"] ? filters["ENTCT_SORT_BY"] : {};
  }

  inventoryRuleActions.value = Array.isArray(rule["actions"]) ? buildActionMap(rule["actions"]) : (rule["actions"] || {});

  const actionTypes = ["ORA_NEXT_RULE", "ORA_MV_TO_QUEUE"]
  ruleActionType.value = Object.keys(inventoryRuleActions.value).find((actionId: string) => {
    return actionTypes.includes(actionId)
  }) || ""
}

function initializeInventoryRules() {
  rulesForReorder.value = commonUtil.sortSequence(JSON.parse(JSON.stringify(getActiveAndDraftOrderRules())))
}

function getActiveAndDraftOrderRules() {
  return inventoryRules.value.filter((rule: Rule) => rule.statusId !== "RULE_ARCHIVED")
}

function getArchivedOrderRules() {
  return inventoryRules.value.filter((rule: Rule) => rule.statusId === "RULE_ARCHIVED")
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


function getRouteIndex() {
  const activeAndDraftRoute = group.value["routings"]?.filter((routing: any) => routing.statusId !== "ROUTING_ARCHIVED")
  if (!activeAndDraftRoute) return '0/0'
  const total = activeAndDraftRoute.length
  const currentRouteIndex: any = Object.keys(activeAndDraftRoute).find((key: any) => activeAndDraftRoute[key].orderRoutingId === activeRoutingId.value)

  return `${+currentRouteIndex + 1}/${total}`
}

function updateRuleStatus(event: CustomEvent, routingRuleId: string) {
  inventoryRules.value.forEach((inventoryRule: any) => {
    if(ruleKey(inventoryRule) === (routingRuleId || activeRuleId.value)) {
      inventoryRule.statusId = event.detail.value
    }
  })

  if(event.detail.value === "RULE_ARCHIVED") {
    activeRule.value = null
  }

  hasUnsavedChanges.value = true
  initializeInventoryRules()
}

function updateRuleFilterValue(event: any, fieldName: string, operator = "") {
  const filters = JSON.parse(JSON.stringify(inventoryRuleFilterOptions.value))
  const filter = filters[conditionFilterEnums[fieldName].code]
  const fieldValue = event.detail.value

  if (filter) {
    filter.fieldValue = fieldValue
    if (operator) filter.operator = operator
  } else {
    filters[conditionFilterEnums[fieldName].code] = {
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: conditionFilterEnums[fieldName].code,
      fieldValue,
      operator: operator || "equals",
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
    commonUtil.showToast(translate("Please select a rule first"));
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
          commonUtil.showToast(translate("Please enter a valid name"))
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
      // In the simulation fork, added rules are kept in-memory only. They must NOT
      // be assigned a routingRuleId so the diff engine treats them as ADD_RULE.
      // A client-only _tempId provides a stable :key for the template.
      const newRule = {
        _tempId: `temp-rule-${++tempIdCounter}`,
        orderRoutingId: activeRouting.value.orderRoutingId,
        ruleName,
        statusId: "RULE_DRAFT",
        sequenceNum: inventoryRules.value.length && inventoryRules.value[inventoryRules.value.length - 1].sequenceNum >= 0 ? inventoryRules.value[inventoryRules.value.length - 1].sequenceNum + 5 : 0,
        assignmentEnumId: "ORA_SINGLE",
        createdDate: DateTime.now().toMillis(),
        inventoryFilters: [],
        actions: [{ actionTypeEnumId: "ORA_NEXT_RULE", actionValue: "" }]
      }

      inventoryRules.value.push(newRule)
      hasUnsavedChanges.value = true
      initializeInventoryRules()
      const created = rulesForReorder.value.find((r: any) => r._tempId === newRule._tempId)
      if (created) selectRule(created)
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

// Flush the active rule's editor state (filter/sort/action option maps) back into the
// in-memory rule object, using the flat-array shape the diff engine consumes.
function syncActiveRuleDraft() {
  const key = activeRuleId.value
  if (!key || !activeRule.value) return

  const inventoryFilters = [
    ...Object.values(inventoryRuleFilterOptions.value || {}),
    ...Object.values(inventoryRuleSortOptions.value || {})
  ].map((c: any) => ({ ...c }))

  const actions = Object.values(inventoryRuleActions.value || {}).map((a: any) => ({
    actionTypeEnumId: a.routingActionTypeId || a.actionTypeEnumId,
    actionValue: a.actionValue,
    ...(a.routingRuleId ? { routingRuleId: a.routingRuleId } : {})
  }))

  // Write into the editor-side rule object...
  activeRule.value.inventoryFilters = inventoryFilters
  activeRule.value.actions = actions
  rulesInformation.value[key] = activeRule.value

  // ...and back into the local rules list that mirrors the routing's rules.
  const idx = inventoryRules.value.findIndex((r: any) => ruleKey(r) === key)
  if (idx >= 0) {
    inventoryRules.value[idx] = {
      ...inventoryRules.value[idx],
      ...activeRule.value,
      inventoryFilters,
      actions
    }
  }
}

// Flush all local editor state (active routing's order filters/sorts + its rules) into
// the simulation working copy so saveAsVariation snapshots the latest edits. Performs
// no network writes — it only mutates sim.working in memory.
function syncWorkingFromLocalState() {
  if (!activeRouting.value) return

  activeRouting.value.orderFilters = [
    ...Object.values(orderRoutingFilterOptions.value || {}),
    ...Object.values(orderRoutingSortOptions.value || {})
  ].map((c: any) => ({ ...c }))

  // inventoryRules holds active+archived rules for the active routing in edited order.
  activeRouting.value.rules = JSON.parse(JSON.stringify(inventoryRules.value))
}

function initializeOrderRoutingOptions() {
  if (!activeRouting.value?.orderFilters) {
    orderRoutingFilterOptions.value = {};
    orderRoutingSortOptions.value = {};
    return;
  }

  const orderRouteFilters = commonUtil.sortSequence(JSON.parse(JSON.stringify(activeRouting.value.orderFilters))).reduce((filters: any, filter: any) => {
    if(filters[filter.conditionTypeEnumId]) {
      filters[filter.conditionTypeEnumId][filter.fieldName] = filter
    } else {
      filters[filter.conditionTypeEnumId] = {
        [filter.fieldName]: filter
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



// Local-only routing status edit; mutates the in-memory working routing.
function updateRoutingStatus(statusId: string) {
  if (activeRouting.value) {
    activeRouting.value.statusId = statusId
  }
  hasUnsavedChanges.value = true
}

function updateOrderFilterValue(event: CustomEvent, fieldName: string, multi = false) {
  const value = multi ? event.detail.value.join(",") : event.detail.value
  const filter = orderRoutingFilterOptions.value[fieldName]
  if(filter) {
    filter.fieldValue = value
  } else {
    orderRoutingFilterOptions.value[fieldName] = {
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName,
      fieldValue: value,
      operator: "equals"
    }
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
  const previousSeq = JSON.parse(JSON.stringify(group.value.routings))
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(group.value.routings)));

  const updatedSeqenceNum = previousSeq.map((routing: any) => routing.sequenceNum)
  Object.keys(updatedSeq).map((key: any, index: number) => {
    updatedSeq[key].sequenceNum = updatedSeqenceNum[index]
  })

  group.value.routings = updatedSeq
  hasUnsavedChanges.value = true
  isReordering.value = false
}

async function addOrderRouteFilterOptions(parentEnumId: string, conditionTypeEnumId: string, label = "") {
  if (!activeRouting.value?.orderRoutingId) {
    commonUtil.showToast(translate("Please select a routing first"));
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

function doReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(rulesForReorder.value))
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(rulesForReorder.value)));

  const updatedSeqenceNum = previousSeq.map((rule: any) => rule.sequenceNum)
  Object.keys(updatedSeq).map((key: any, index: number) => {
    updatedSeq[key].sequenceNum = updatedSeqenceNum[index]
  })

  rulesForReorder.value = updatedSeq

  // Update original inventoryRules to maintain state
  inventoryRules.value.forEach((rule: any) => {
    const updatedRule = updatedSeq.find((seq: any) => ruleKey(seq) === ruleKey(rule))
    if(updatedRule) {
      rule.sequenceNum = updatedRule.sequenceNum
    }
  })
  hasUnsavedChanges.value = true
  isReordering.value = false
}

async function openArchivedRoutingModal() {
  const archivedRoutingModal = await modalController.create({
    component: ArchivedRoutingModal,
    componentProps: {
      archivedRoutings: group.value?.routings?.filter((routing: any) => routing.statusId === "ROUTING_ARCHIVED") || [],
      saveRoutings: (routings: any) => {
        if(routings) {
          initializeFromWorking()
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
