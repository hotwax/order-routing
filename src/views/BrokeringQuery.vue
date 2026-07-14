<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/brokering/${currentRoutingGroup.routingGroupId}/routes`" />
        </ion-buttons>
        <ion-title>{{ translate("Routing") }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :disabled="isTestEnabled" :aria-label="translate('Circuit')" @click="openCircuitAssistant">
            <ion-icon slot="start" :icon="sparklesOutline" />
            {{ translate("Circuit") }}
          </ion-button>
          <ion-button v-if="isSimulationAvailable" :disabled="isTestEnabled" :aria-label="translate('Simulate')" @click="openSimulation">
            <ion-icon slot="start" :icon="flaskOutline" />
            {{ translate("Simulate") }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <main class="routing-detail-canvas">
        <section id="routing-context" class="menu routing-context-column">
          <ion-item lines="none">
            <ion-label class="ion-text-wrap">
              <p>{{ translate("Brokering run") }}</p>
              <h1>{{ currentRoutingGroup.groupName }}</h1>
            </ion-label>
          </ion-item>
          <ion-list>
            <ion-item-divider color="light">
              <ion-label>{{ translate("Order batches") }}</ion-label>
              <ion-button v-if="!isTestEnabled" slot="end" fill="clear" @click="createOrderRouteFromCanvas">
                <ion-icon slot="start" :icon="addCircleOutline" />
                {{ translate("New") }}
              </ion-button>
            </ion-item-divider>
            <ion-reorder-group v-if="getActiveAndDraftOrderRoutings().length" @ionItemReorder="doOrderRoutingReorder($event)" :disabled="isTestEnabled">
              <ion-item
                v-for="(routing, index) in getActiveAndDraftOrderRoutings()"
                :key="routing.orderRoutingId"
                button
                lines="full"
                :color="isSelectedOrderRouting(routing) ? 'light' : ''"
                :disabled="isTestEnabled"
                @click="switchOrderRouting(routing)"
              >
                <ion-label>
                  <h2>{{ routing.routingName }}</h2>
                  <ion-note>
                    {{ `${index + 1}/${getActiveAndDraftOrderRoutings().length}` }} · {{ getOrderRoutingStatusLabel(routing) }}
                  </ion-note>
                </ion-label>
                <ion-button v-if="!isTestEnabled" slot="end" fill="clear" color="medium" @click.stop="cloneRoutingFromCanvas(routing)">
                  <ion-icon slot="icon-only" :icon="copyOutline" />
                </ion-button>
                <ion-reorder v-show="getActiveAndDraftOrderRoutings().length > 1" slot="end" />
              </ion-item>
            </ion-reorder-group>
            <ion-item v-if="getArchivedOrderRoutings().length" button lines="full" @click="openArchivedRoutingModal">
              <ion-label>{{ translate("Archived") }}</ion-label>
              <ion-badge color="medium">{{ getArchivedOrderRoutings().length }} {{ translate(getArchivedOrderRoutings().length > 1 ? "routings" : "routing") }}</ion-badge>
            </ion-item>
            <ion-item v-if="!getActiveAndDraftOrderRoutings().length" lines="none">
              <ion-label color="medium" class="ion-text-wrap">
                {{ translate("No order batches yet") }}
                <p>{{ translate("Create an order batch to define routing rules and policies for this run.") }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
          <ion-button v-if="!isTestEnabled && !getActiveAndDraftOrderRoutings().length" fill="outline" @click="createOrderRouteFromCanvas">
            {{ translate("Create order batch") }}
            <ion-icon slot="end" :icon="addCircleOutline" />
          </ion-button>
        </section>
        <section id="order-filters" class="menu ion-padding-top">
          <ion-item lines="none">
            <ion-label>
              <h1 v-show="!isRouteNameUpdating || isTestEnabled">{{ currentRouting.routingName }}</h1>
              <!-- Added class as we can't change the background of ion-input with css property, and we need to change the background to show the user that now this value is editable -->
              <ion-input ref="routeNameRef" :class="isRouteNameUpdating ? 'name' : ''" v-show="isRouteNameUpdating" aria-label="route name" v-model="routeName"></ion-input>
            </ion-label>
            <ion-chip slot="end" outline>
              {{ getRouteIndex() }}
            </ion-chip>
          </ion-item>
          <ion-button v-if="!isTestEnabled" class="ion-margin-start" color="medium" fill="outline" size="small" @click="isRouteNameUpdating ? updateRouteName() : editRouteName()">
            <ion-icon slot="start" :icon="isRouteNameUpdating ? saveOutline : pencilOutline" />
            {{ isRouteNameUpdating ? translate("Save") : translate("Rename") }}
          </ion-button>
          <ion-button class="ion-margin-start" color="medium" fill="outline" size="small" @click="enableRoutingTest()" :disabled="routingStatus !== 'ROUTING_ACTIVE' || hasUnsavedChanges || testRoutingInfo.isRuleTestEnabled" v-if="!useUserStore().hasPermission('ROUTING_TEST_DRIVE_VIEW')">
            <ion-icon slot="start" :icon="speedometerOutline" />
            {{ translate(testRoutingInfo.isRoutingTestEnabled ? "Exit test mode" : "Test") }}
          </ion-button>
          <!-- <ion-button color="medium" fill="outline" size="small">
            <ion-icon slot="start" :icon="copyOutline" />
            {{ translate("Clone") }}
          </ion-button> -->
          <ion-item :disabled="isTestEnabled">
            <ion-icon slot="start" :icon="pulseOutline" />
            <ion-select :label="translate('Status')" interface="popover" :interface-options="{ subHeader: translate('Status') }" :value="routingStatus" @ionChange="updateOrderRouting($event.detail.value)">
              <ion-select-option value="ROUTING_ACTIVE">{{ translate("Active") }}</ion-select-option>
              <ion-select-option value="ROUTING_DRAFT">{{ translate("Draft") }}</ion-select-option>
              <ion-select-option value="ROUTING_ARCHIVED">{{ translate("Archive") }}</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item lines="full">
            <ion-icon :icon="timeOutline" slot="start" />
            <ion-label>{{ translate("Last run") }}</ion-label>
            <ion-chip outline @click.stop="openRoutingHistoryModal()">
              <ion-label>{{ routingHistory[currentRouting.orderRoutingId] ? commonUtil.getDateAndTimeShort(routingHistory[currentRouting.orderRoutingId][0].startDate) : "-" }}</ion-label>
            </ion-chip>
          </ion-item>
          <ion-item-group>
            <ion-item-divider color="light">
              <ion-label>{{ translate("Filters") }}</ion-label>
              <ion-button size="default" :disabled="isTestEnabled" v-if="orderRoutingFilterOptions && Object.keys(orderRoutingFilterOptions).length" slot="end" fill="clear" @click="addOrderRouteFilterOptions('ORD_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </ion-item-divider>
            <p class="empty-state" v-if="!orderRoutingFilterOptions || !Object.keys(orderRoutingFilterOptions).length">
              {{ translate("All orders in all parkings will be attempted if no filter is applied.") }}
              <ion-button :disabled="isTestEnabled" fill="clear" @click="addOrderRouteFilterOptions('ORD_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                {{ translate("Add filters") }}
                <ion-icon slot="end" :icon="optionsOutline"/>
              </ion-button>
            </p>
            <!-- Using hardcoded options for filters, as in filters we have multiple ways of value selection for filters like select, chip -->
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY')">
              <ion-select multiple :placeholder="translate('product category')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY').fieldValue?.split(',')" @ionFocus="ensureCatalogCategories" @click="ensureCatalogCategories" @ionChange="updateOrderFilterValue($event, 'PROD_CATEGORY', true)">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['PROD_CATEGORY']?.code)" color="danger" :icon="closeCircleOutline" slot="start"/>
                  {{ translate("Product Category") }}
                </div>
                <ion-select-option v-for="(category, productCategoryId) in catalogCategories" :key="productCategoryId" :value="productCategoryId">{{ category.categoryName || productCategoryId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY_EXCLUDED')">
              <ion-select multiple :placeholder="translate('product category')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY_EXCLUDED').fieldValue?.split(',')" @ionFocus="ensureCatalogCategories" @click="ensureCatalogCategories" @ionChange="updateOrderFilterValue($event, 'PROD_CATEGORY_EXCLUDED', true)">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['PROD_CATEGORY_EXCLUDED']?.code)" color="danger" :icon="closeCircleOutline"/>
                  <ion-label>{{ translate("Product Category") }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(category, productCategoryId) in catalogCategories" :key="productCategoryId" :value="productCategoryId">{{ category.categoryName || productCategoryId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE')">
              <ion-select multiple :placeholder="translate('queue')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'QUEUE', true)">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['QUEUE']?.code)" color="danger" :icon="closeCircleOutline" slot="start"/>
                  {{ translate("Queue") }}
                </div>
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE_EXCLUDED')">
              <ion-select multiple :placeholder="translate('queue')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'QUEUE_EXCLUDED', true)">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['QUEUE_EXCLUDED']?.code)" color="danger" :icon="closeCircleOutline"/>
                  <ion-label>{{ translate("Queue") }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD')">
              <ion-select multiple :placeholder="translate('shipping method')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SHIPPING_METHOD', true)">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['SHIPPING_METHOD']?.code)" color="danger" :icon="closeCircleOutline" slot="start"/>
                  {{ translate("Shipping method") }}
                </div>
                <ion-select-option v-for="(shippingMethod, shippingMethodId) in shippingMethods" :key="shippingMethodId" :value="shippingMethodId">{{ shippingMethod.description || shippingMethodId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD_EXCLUDED')">
              <ion-select multiple :placeholder="translate('shipping method')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SHIPPING_METHOD_EXCLUDED', true)">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['SHIPPING_METHOD_EXCLUDED']?.code)" color="danger" :icon="closeCircleOutline"/>
                  <ion-label>{{ translate('Shipping method') }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(shippingMethod, shippingMethodId) in shippingMethods" :key="shippingMethodId" :value="shippingMethodId">{{ shippingMethod.description || shippingMethodId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY')">
              <ion-select :placeholder="translate('priority')" interface="popover" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY').fieldValue" @ionChange="updateOrderFilterValue($event, 'PRIORITY')">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['PRIORITY']?.code)" color="danger" :icon="closeCircleOutline" slot="start"/>
                  {{ translate("Order priority") }}
                </div>
                <ion-select-option value="HIGH">{{ translate("High") }}</ion-select-option>
                <ion-select-option value="MEDIUM">{{ translate("Medium") }}</ion-select-option>
                <ion-select-option value="Low">{{ translate("Low") }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY_EXCLUDED')">
              <ion-select :placeholder="translate('priority')" interface="popover" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY_EXCLUDED').fieldValue" @ionChange="updateOrderFilterValue($event, 'PRIORITY_EXCLUDED')">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['PRIORITY_EXCLUDED']?.code)" color="danger" :icon="closeCircleOutline" slot="start"/>
                  <ion-label>{{ translate('Order priority') }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option value="HIGH">{{ translate("High") }}</ion-select-option>
                <ion-select-option value="MEDIUM">{{ translate("Medium") }}</ion-select-option>
                <ion-select-option value="Low">{{ translate("Low") }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROMISE_DATE')">
              <ion-icon v-show="isFilterUnmatched(ruleEnums['PROMISE_DATE']?.code)" color="danger" :icon="closeCircleOutline" slot="start"/>
              <ion-label>{{ translate("Promise date") }}</ion-label>
              <ion-chip outline @click="selectPromiseFilterValue($event)">
                {{ getPromiseDateValue("PROMISE_DATE") }}
              </ion-chip>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROMISE_DATE_EXCLUDED')">
              <ion-icon v-show="isFilterUnmatched(ruleEnums['PROMISE_DATE_EXCLUDED']?.code)" color="danger" :icon="closeCircleOutline" slot="start"/>
              <ion-label>{{ translate("Promise date") }}</ion-label>
              <ion-chip outline @click="selectPromiseFilterValue($event, 'excluded')">
                {{ getPromiseDateValue("PROMISE_DATE_EXCLUDED") }}
              </ion-chip>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL')">
              <ion-select multiple :placeholder="translate('sales channel')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SALES_CHANNEL', true)">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['SALES_CHANNEL']?.code)" color="danger" :icon="closeCircleOutline" slot="start"/>
                  {{ translate("Sales Channel") }}
                </div>
                <ion-select-option v-for="(enumInfo, enumId) in enums['ORDER_SALES_CHANNEL']" :key="enumId" :value="enumId">{{ enumInfo.description || enumInfo.enumId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL_EXCLUDED')">
              <ion-select multiple :placeholder="translate('sales channel')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SALES_CHANNEL_EXCLUDED', true)">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['SALES_CHANNEL_EXCLUDED']?.code)" color="danger" :icon="closeCircleOutline" slot="start"/>
                  <ion-label>{{ translate('Sales Channel') }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(enumInfo, enumId) in enums['ORDER_SALES_CHANNEL']" :key="enumId" :value="enumId">{{ enumInfo.description || enumInfo.enumId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP')">
              <ion-select multiple :placeholder="translate('facility group')" :label="translate('Origin Facility Group')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'ORIGIN_FACILITY_GROUP', true)">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['ORIGIN_FACILITY_GROUP']?.code)" color="danger" :icon="closeCircleOutline" slot="start"/>
                  {{ translate("Origin Facility Group") }}
                </div>
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in facilityGroups" :key="facilityGroupId" :value="facilityGroupId">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item :disabled="isTestEnabled" v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP_EXCLUDED')">
              <ion-select multiple :placeholder="translate('facility group')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'ORIGIN_FACILITY_GROUP_EXCLUDED', true)">
                <div slot="label">
                  <ion-icon v-show="isFilterUnmatched(ruleEnums['ORIGIN_FACILITY_GROUP_EXCLUDED']?.code)" color="danger" :icon="closeCircleOutline" slot="start"/>
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
              <ion-button size="default" :disabled="isTestEnabled" v-if="orderRoutingSortOptions && Object.keys(orderRoutingSortOptions).length" slot="end" fill="clear" @click="addOrderRouteFilterOptions('ORD_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </ion-item-divider>
            <!-- Added check for undefined as well as empty object, as on initial load there might be a case in which route sorting options are not available thus it will be undefined but when updating the values from the modal this will always return an object -->
            <p class="empty-state" v-if="!orderRoutingSortOptions || !Object.keys(orderRoutingSortOptions).length">
              {{ translate("Orders will be brokered based on order date if no sorting is specified.") }}
              <ion-button :disabled="isTestEnabled" fill="clear" @click="addOrderRouteFilterOptions('ORD_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                {{ translate("Add sorting") }}
                <ion-icon slot="end" :icon="optionsOutline"/>
              </ion-button>
            </p>
            <ion-reorder-group @ionItemReorder="doRouteSortReorder($event)" :disabled="isTestEnabled">
              <ion-item :disabled="isTestEnabled" v-for="(sort, code) in orderRoutingSortOptions" :key="code">
                <ion-label>{{ getLabel("ORD_SORT_PARAM_TYPE", String(code)) || code }}</ion-label>
                <ion-reorder />
              </ion-item>
            </ion-reorder-group>
          </ion-item-group>
        </section>
        <section v-if="inventoryRules.length" id="inventory-rules">
          <section id="inventory-sequence" class="menu">
            <ion-list>
              <ion-reorder-group @ionItemReorder="doReorder($event)" :disabled="isTestEnabled">
                <ion-item class="rule-item" lines="full" v-for="rule in rulesForReorder" :key="rule.routingRuleId" :color="rule.routingRuleId === selectedRoutingRule?.routingRuleId ? 'light' : ''" @click="!isTestEnabled && fetchRuleInformation(rule.routingRuleId)" button :class="{ 'selected-rule': testRoutingInfo.selectedRuleId === rule.routingRuleId }">
                  <ion-label>
                    <h2>{{ rule.ruleName }}</h2>
                    <ion-note :color="rule.statusId === 'RULE_ACTIVE' ? 'success' : rule.statusId === 'RULE_ARCHIVED' ? 'warning' : ''">{{ rule.statusId === "RULE_ACTIVE" ? translate("Active") : rule.statusId === "RULE_ARCHIVED" ? translate("Archived") : translate("Draft") }}</ion-note>
                  </ion-label>
                  <!-- Don't display reordering option when there is a single rule -->
                  <ion-reorder v-show="rulesForReorder.length > 1" />
                </ion-item>
              </ion-reorder-group>
              <ion-item v-if="getArchivedOrderRules().length > 0" button @click="openArchivedRuleModal()" lines="full">
                <ion-label>{{ translate("Archived") }}</ion-label>
                <ion-badge color="medium">{{ getArchivedOrderRules().length }}{{ translate(getArchivedOrderRules().length > 1 ? "rules" : "rule") }}</ion-badge>
              </ion-item>
            </ion-list>
            <ion-button v-if="!isTestEnabled" fill="outline" @click="addInventoryRule">
              {{ translate("Add inventory rule") }}
              <ion-icon :icon="addCircleOutline" slot="end"/>
            </ion-button>
          </section>
          <template v-if="!testRoutingInfo.isRoutingTestEnabled">
            <div v-if="selectedRoutingRule?.routingRuleId">
              <ion-card class="rule-info">
                <ion-item lines="none">
                  <ion-label>
                    <p>{{ getRuleIndex() }}</p>
                    <h1 v-show="!isRuleNameUpdating">{{ selectedRoutingRule.ruleName }}</h1>
                  </ion-label>
                  <!-- Added class as we can't change the background of ion-input with css property, and we need to change the background to show the user that now this value is editable -->
                  <ion-input ref="ruleNameRef" :class="isRuleNameUpdating ? 'name' : ''" v-show="isRuleNameUpdating" aria-label="rule name" v-model="selectedRoutingRule.ruleName"></ion-input>
                </ion-item>
                <div>
                  <ion-item :disabled="testRoutingInfo.isRuleTestEnabled">
                    <ion-icon slot="start" :icon="pulseOutline" />
                    <ion-select :label="translate('Status')" interface="popover" :value="getRuleStatus(selectedRoutingRule.routingRuleId)" :interface-options="{ subHeader: translate('Status') }" @ionChange="updateRuleStatus($event, selectedRoutingRule.routingRuleId)">
                      <ion-select-option value="RULE_ACTIVE">{{ translate("Active") }}</ion-select-option>
                      <ion-select-option value="RULE_DRAFT">{{ translate("Draft") }}</ion-select-option>
                      <ion-select-option value="RULE_ARCHIVED">{{ translate("Archived") }}</ion-select-option>
                    </ion-select>
                  </ion-item>
                  <ion-item lines="none">
                    <div slot="end">
                      <ion-button v-if="!testRoutingInfo.isRuleTestEnabled" size="small" @click="isRuleNameUpdating ? updateRuleName(selectedRoutingRule.routingRuleId) : editRuleName()" fill="outline">
                        <ion-icon slot="start" :icon="isRuleNameUpdating ? saveOutline : pencilOutline" />
                        {{ isRuleNameUpdating ? translate("Save") : translate("Rename") }}
                      </ion-button>
                      <ion-button class="ion-margin-start" color="medium" fill="outline" size="small" @click="enableRuleTest()" :disabled="selectedRoutingRule.statusId !== 'RULE_ACTIVE' || routingStatus !== 'ROUTING_ACTIVE' || hasUnsavedChanges" v-if="!useUserStore().hasPermission('ROUTING_TEST_DRIVE_VIEW')">
                        <ion-icon slot="start" :icon="speedometerOutline" />
                        {{ translate(testRoutingInfo.isRuleTestEnabled ? "Exit test mode" : "Test") }}
                      </ion-button>
                      <!-- <ion-button size="small" @click="cloneRule" fill="outline">
                        <ion-icon slot="start" :icon="copyOutline"/>
                        {{ translate("Clone") }}
                      </ion-button> -->
                    </div>
                  </ion-item>
                </div>
              </ion-card>
              <template v-if="!testRoutingInfo.isRuleTestEnabled">
                <section class="filters">
                  <ion-card>
                    <ion-item>
                      <ion-icon slot="start" :icon="filterOutline"/>
                      <h4>{{ translate("Filters") }}</h4>
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
                        <ion-select-option v-for="(facilityGroup, facilityGroupId) in getFacilityGroupsForBrokering()" :key="facilityGroupId" :value="facilityGroupId" :disabled="isFacilityGroupSelected(String(facilityGroupId), 'included')">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
                      </ion-select>
                    </ion-item>
                    <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED')">
                      <ion-select :placeholder="translate('facility group')" interface="popover" :selected-text="getSelectedValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED') || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED').fieldValue" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED').fieldValue" @ionChange="updateRuleFilterValue($event, 'FACILITY_GROUP_EXCLUDED')">
                        <div slot="label">
                          <ion-label>{{ translate("Group") }}</ion-label>
                          <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                        </div>
                        <ion-select-option v-for="(facilityGroup, facilityGroupId) in getFacilityGroupsForBrokering()" :key="facilityGroupId" :value="facilityGroupId" :disabled="isFacilityGroupSelected(String(facilityGroupId), 'excluded')">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
                      </ion-select>
                    </ion-item>
                    <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'PROXIMITY')">
                      <!-- TODO: Confirm on the possible options -->
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
                          <!-- Added click.stop to override the default click event of ion-select, as we handled the click event using ion-chip -->
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
                    <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'WOS')">
                      <ion-label>{{ translate('Week of Supply') }}</ion-label>
                      <ion-chip slot="end" outline @click="selectValue('WOS', 'Add week of supply')">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "WOS").fieldValue || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "WOS").fieldValue == 0 ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "WOS").fieldValue : "-" }}</ion-chip>
                    </ion-item>
                  </ion-card>
                  <ion-card>
                    <ion-item>
                      <ion-icon slot="start" :icon="swapVerticalOutline"/>
                      <h4>{{ translate("Sort") }}</h4>
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
                        <ion-reorder />
                      </ion-item>
                    </ion-reorder-group>
                  </ion-card>
                </section>
                <section>
                  <h2 class="ion-padding-start">{{ translate("Actions") }}</h2>
                  <div class="actions">
                    <ion-card>
                      <ion-card-header>
                        <ion-card-title>
                          {{ translate("Partially available") }}
                        </ion-card-title>
                      </ion-card-header>
                      <ion-card-content>
                        {{ translate("Select if partial allocation should be allowed in this inventory rule") }}
                      </ion-card-content>
                      <ion-item lines="none">
                        <ion-toggle :disabled="isPromiseDateFilterApplied()" :checked="selectedRoutingRule.assignmentEnumId === 'ORA_MULTI'" @ionChange="updatePartialAllocation($event.detail.checked)">{{ translate("Allow partial allocation") }}</ion-toggle>
                      </ion-item>
                      <ion-item v-show="isPromiseDateFilterApplied()" lines="none">
                        <ion-label class="ion-text-wrap">
                          <p>{{ translate("Partial allocation cannot be disabled. Orders are filtered by item when filtering by promise date.") }}</p>
                        </ion-label>
                      </ion-item>
                      <ion-item lines="none">
                        <ion-toggle :disabled="selectedRoutingRule.assignmentEnumId !== 'ORA_MULTI' && !isPromiseDateFilterApplied()" :checked="isPartialGroupItemsAllocationActive()" @ionChange="updatePartialGroupItemsAllocation($event.detail.checked)">{{ translate("Partially allocate grouped items") }}</ion-toggle>
                      </ion-item>
                    </ion-card>
                    <ion-card>
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
                  </div>
                </section>
              </template>
              <BrokeringRouteTest v-if="testRoutingInfo.isRuleTestEnabled" :routingRuleId="selectedRoutingRule?.routingRuleId" :orderRoutingId="orderRoutingId" :routingGroupId="currentRoutingGroup.routingGroupId" :orderRoutingFilterOptions="orderRoutingFilterOptions" :userTestingSession="userTestingSession"/>
            </div>
            <div class="empty-state" v-else>{{ translate("Please select a rule or refresh") }}</div>
          </template>
          <BrokeringRouteTest v-if="testRoutingInfo.isRoutingTestEnabled" :orderRoutingId="orderRoutingId" :routingGroupId="currentRoutingGroup.routingGroupId" :orderRoutingFilterOptions="orderRoutingFilterOptions" :userTestingSession="userTestingSession"/>
        </section>
        <section v-else class="empty-state">
          <img src="../assets/images/InventoryRuleEmptyState.png" />
          <ion-button @click="addInventoryRule">
            {{ translate("Add inventory rule") }}
            <ion-icon slot="end" :icon="addCircleOutline"></ion-icon>
          </ion-button>
        </section>
      </main>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed" v-if="!testRoutingInfo.isRoutingTestEnabled">
        <ion-fab-button :disabled="!hasUnsavedChanges" @click="save">
          <ion-icon :icon="saveOutline" />
        </ion-fab-button>
      </ion-fab>
    </ion-content>

    <ion-modal :is-open="showCircuitAssistant" @didDismiss="showCircuitAssistant = false">
      <RoutingEditorAssistantPanel
        v-if="showCircuitAssistant"
        :context="getRoutingContext()"
        :prepare-draft-proposal="prepareCircuitDraftProposal"
        :apply-draft-proposal="applyCircuitDraftProposal"
        @dismiss="showCircuitAssistant = false"
      />
    </ion-modal>

    <ion-modal class="simulation-workspace-modal" :is-open="showSimulationWorkspace" :backdrop-dismiss="false" @didDismiss="showSimulationWorkspace = false">
      <RoutingEditorSimulationPanel
        v-if="showSimulationWorkspace"
        :routing-group="currentRoutingGroup"
        :order-routing-id="props.orderRoutingId"
        @dismiss="showSimulationWorkspace = false"
      />
    </ion-modal>
  </ion-page>
</template>

<script setup lang="ts">
import { IonBackButton, IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonChip, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonInput, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonModal, IonNote, IonPage, IonReorder, IonReorderGroup, IonSelect, IonSelectOption, IonTitle, IonToggle, IonToolbar, alertController, modalController, onIonViewWillEnter, popoverController } from "@ionic/vue";
import { addCircleOutline, closeCircleOutline, copyOutline, filterOutline, flaskOutline, golfOutline, optionsOutline, pencilOutline, playForwardOutline, pulseOutline, saveOutline, sparklesOutline, speedometerOutline, swapVerticalOutline, timeOutline } from "ionicons/icons"
import { onBeforeRouteLeave } from "vue-router";
import router from "@/router";
import { computed, nextTick, ref, watch } from "vue";
import AddInventoryFilterOptionsModal from "@/components/AddInventoryFilterOptionsModal.vue";
import { logger, emitter, translate, commonUtil } from "@common";
import { Route, Rule } from "@/types";
import AddOrderRouteFilterOptions from "@/components/AddOrderRouteFilterOptions.vue"
import PromiseFilterPopover from "@/components/PromiseFilterPopover.vue"
import { DateTime } from "luxon";
import RoutingHistoryModal from "@/components/RoutingHistoryModal.vue"
import ArchivedRuleModal from "@/components/ArchivedRuleModal.vue";
import ArchivedRoutingModal from "@/components/ArchivedRoutingModal.vue";
import BrokeringRouteTest from "./BrokeringRouteTest.vue";
import { orderRoutingStore } from "@/store/orderRoutingStore";
import { useUtilStore } from "@/store/utilStore";
import { productStore } from "@/store/productStore";
import { useUserStore } from "@/store/userStore";
import { useCircuitStore } from "@/store/circuit";
import { useCreateRouting } from "@/composables/useCreateRouting";
import RoutingEditorAssistantPanel from "@/components/routing-editor/RoutingEditorAssistantPanel.vue";
import RoutingEditorSimulationPanel from "@/components/routing-editor/RoutingEditorSimulationPanel.vue";
import { buildRoutingGroupEditorDraftPayload, buildRoutingGroupEditorSavePayload } from "@/utils/routingGroupEditorPayload";
import { DEFAULT_ACTION_ENUMS, DEFAULT_CONDITION_FILTER_ENUMS, DEFAULT_CONDITION_SORT_ENUMS, DEFAULT_RULE_ENUMS, parseRoutingEditorEnvJson } from "@/utils/routingEditorEnv";
import { isFeatureEnabled } from "@/utils/simConfig";
import { DraftAssistantService } from "@/services/DraftAssistantService";
import type { DraftConversationMessage, DraftProposal } from "@/types/draft";
import { buildBrokeringRulesBindings, buildBrokeringRulesManifest } from "@/utils/brokeringRulesManifest";
import { buildBrokeringAgentSnapshot } from "@/composables/useBrokeringAgentSnapshot";
import { simulationStore } from "@/store/simulationStore";

const props = defineProps({
  routingGroupId: {
    type: String,
    required: false
  },
  orderRoutingId: {
    type: String,
    required: true
  }
})

const ruleEnums = parseRoutingEditorEnvJson(import.meta.env?.VITE_RULE_ENUMS, DEFAULT_RULE_ENUMS)
const actionEnums = parseRoutingEditorEnvJson(import.meta.env?.VITE_RULE_ACTION_ENUMS, DEFAULT_ACTION_ENUMS)
const conditionFilterEnums = parseRoutingEditorEnvJson(import.meta.env?.VITE_RULE_FILTER_ENUMS, DEFAULT_CONDITION_FILTER_ENUMS)
const conditionSortEnums = parseRoutingEditorEnvJson(import.meta.env?.VITE_RULE_SORT_ENUMS, DEFAULT_CONDITION_SORT_ENUMS)

const currentRoutingGroup: any = computed(() => orderRoutingStore().getCurrentRoutingGroup)
const currentRouting = computed(() => orderRoutingStore().getCurrentOrderRouting)
const facilities = computed(() => productStore().getVirtualFacilities)
const catalogCategories = computed((): any => useUtilStore().getCatalogCategories)
const enums = computed(() => useUtilStore().getEnums)
const shippingMethods = computed(() => productStore().getShippingMethods)
const facilityGroups = computed((): any => productStore().getFacilityGroups)
const routingHistory = computed(() => orderRoutingStore().getRoutingHistory)
const currentRuleId = computed(() => orderRoutingStore().getCurrentRuleId)
const testRoutingInfo = computed(() => orderRoutingStore().getTestRoutingInfo)
const userProfile = computed(() => useUserStore().getUserProfile)
const currentEComStore = computed(() => productStore().getCurrentEComStore)

const isFilterUnmatched = computed(() => (id: string) => testRoutingInfo.value.isRoutingTestEnabled && testRoutingInfo.value.unmatchedOrderFilters?.includes(id))
const isTestEnabled = computed(() => testRoutingInfo.value.isRoutingTestEnabled || testRoutingInfo.value.isRuleTestEnabled)
const isSimulationAvailable = computed(() => isFeatureEnabled("simulation"))
const getRuleStatus = computed(() => (ruleId: string) => rulesForReorder.value.find((rule: Rule) => rule.routingRuleId == ruleId)?.statusId)
const showCircuitAssistant = ref(false)
const showSimulationWorkspace = ref(false)
const isSwitchingOrderRouting = ref(false)
const { promptCreateRouting } = useCreateRouting();

function getRoutingContext() {
  return {
    routingGroupId: currentRoutingGroup.value?.routingGroupId || props.routingGroupId || "",
    orderRoutingId: props.orderRoutingId,
    routingRuleId: selectedRoutingRule.value?.routingRuleId || "",
    groupName: currentRoutingGroup.value?.groupName || "",
    routingName: routeName.value || currentRouting.value?.routingName || "",
    ruleName: selectedRoutingRule.value?.ruleName || "",
    label: [
      currentRoutingGroup.value?.groupName,
      routeName.value || currentRouting.value?.routingName,
      selectedRoutingRule.value?.ruleName
    ].filter(Boolean).join(" / ")
  }
}

async function syncCurrentEditorDraftToStore() {
  syncSelectedRuleDraftForSave()
  const hasDirtyGroup = hasUnsavedChanges.value || Boolean(orderRoutingStore().hasUnsavedChanges)

  const draftGroup = buildRoutingGroupEditorDraftPayload({
    group: currentRoutingGroup.value,
    orderRoutingId: props.orderRoutingId,
    routingPatch: {
      routingName: routeName.value || currentRouting.value.routingName,
      statusId: routingStatus.value
    },
    orderRoutingFilterOptions: orderRoutingFilterOptions.value,
    orderRoutingSortOptions: orderRoutingSortOptions.value,
    inventoryRules: inventoryRules.value,
    rulesInformation: rulesInformation.value
  })

  await orderRoutingStore().setCurrentGroup(draftGroup, hasDirtyGroup)
  await orderRoutingStore().setCurrentOrderRouting(props.orderRoutingId)
  return draftGroup
}

async function openCircuitAssistant() {
  await syncCurrentEditorDraftToStore()
  useCircuitStore().setActiveContext(getRoutingContext())
  showCircuitAssistant.value = true
}

async function openSimulation() {
  const routingGroupId = currentRoutingGroup.value?.routingGroupId || props.routingGroupId
  if(routingGroupId) {
    const draftGroup = await syncCurrentEditorDraftToStore()
    await simulationStore().startFromLiveGroup(draftGroup)
    showSimulationWorkspace.value = true
  }
}

type CircuitDraftProposal = DraftProposal & {
  id: string;
  sourcePrompt: string;
  createdAt: number;
};

async function prepareCircuitDraftProposal(prompt: string, conversationHistory: DraftConversationMessage[] = []) {
  if(!currentRouting.value?.orderRoutingId) {
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

  if(proposal.intent === "inquiry") {
    return {
      proposal: null,
      message: formatInquiryMessage(proposal),
      intent: "inquiry" as const
    };
  }

  if(proposal.unansweredQuestions.length && !proposal.operations.length) {
    commonUtil.showToast(proposal.unansweredQuestions[0]);
    return {
      proposal: null,
      message: proposal.unansweredQuestions[0],
      intent: proposal.intent
    };
  }

  if(pendingProposal) {
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
  if(!currentRouting.value?.orderRoutingId) {
    return {
      appliedCount: 0,
      message: translate("Select a routing context before asking Circuit to draft changes.")
    };
  }

  const manifest = await buildCircuitDraftManifest();
  const result = await DraftAssistantService.applyDraftProposal(proposal, manifest, {
    createSiblingRouting: async () => "",
    selectRouting: () => undefined,
    buildBindings: () => buildCircuitDraftBindings()
  });

  hasUnsavedChanges.value = true;

  const unansweredQuestions = [...(proposal.unansweredQuestions || []), ...result.unansweredQuestions];
  if(unansweredQuestions.length) {
    commonUtil.showToast(unansweredQuestions[0]);
    return {
      appliedCount: result.appliedCount,
      message: unansweredQuestions[0]
    };
  }

  if(result.skipped?.length) {
    return {
      appliedCount: result.appliedCount,
      message: result.skipped[0]
    };
  }

  return {
    appliedCount: result.appliedCount,
    message: proposal.summary || translate("Applied draft changes")
  };
}

function buildCircuitDraftBindings() {
  return buildBrokeringRulesBindings({
    orderRoutingId: props.orderRoutingId,
    selectedRoutingRule,
    routingStatus,
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
    useUtilStore().fetchEnums({ productStoreId: currentRoutingGroup.value.productStoreId }),
    useUtilStore().fetchStatusInformation()
  ])

  return buildBrokeringRulesManifest({
    pageRoute: router.currentRoute.value.fullPath,
    orderRoutingId: props.orderRoutingId,
    routingName: routeName.value || currentRouting.value?.routingName || "",
    routingStatus: routingStatus.value || currentRouting.value?.statusId || "",
    brokeringRun: {
      routingGroupId: currentRoutingGroup.value?.routingGroupId || props.routingGroupId || "",
      groupName: currentRoutingGroup.value?.groupName || "",
      productStoreId: currentRoutingGroup.value?.productStoreId || "",
      schedule: currentRoutingGroup.value?.job || currentRoutingGroup.value?.schedule || null,
      routings: (currentRoutingGroup.value?.routings || []).map((routing: any) => ({
        orderRoutingId: routing.orderRoutingId,
        routingName: routing.routingName,
        statusId: routing.statusId,
        sequenceNum: routing.sequenceNum
      }))
    },
    selectedRoutingRule: selectedRoutingRule.value || {},
    isTestEnabled: isTestEnabled.value,
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

let ruleActionType = ref("")
let selectedRoutingRule = ref({}) as any
let inventoryRules = ref([]) as any
let orderRoutingFilterOptions = ref({}) as any
let orderRoutingSortOptions = ref({}) as any
let inventoryRuleFilterOptions = ref({}) as any
let inventoryRuleSortOptions = ref({}) as any
let inventoryRuleActions = ref({}) as any
let rulesInformation = ref({}) as any
let hasUnsavedChanges = ref(false)
let isRuleNameUpdating = ref(false)
let routingStatus = ref("")
let routeName = ref("")
let isRouteNameUpdating = ref(false)
let rulesForReorder = ref([]) as any
let userTestingSession = ref({}) as any
let isCatalogCategoriesLoading = false
let routeLoadRequestId = 0

const routeNameRef = ref()
const operatorRef = ref()
const measurementRef = ref()
const ruleNameRef = ref()

function getRouteRoutingGroupId() {
  return String(props.routingGroupId || router.currentRoute.value.params.routingGroupId || "")
}

function getActiveAndDraftOrderRoutings() {
  return commonUtil.sortSequence(JSON.parse(JSON.stringify(currentRoutingGroup.value?.routings || [])))
    .filter((routing: Route) => routing.statusId !== "ROUTING_ARCHIVED")
}

function getArchivedOrderRoutings() {
  return commonUtil.sortSequence(JSON.parse(JSON.stringify(currentRoutingGroup.value?.routings || [])))
    .filter((routing: Route) => routing.statusId === "ROUTING_ARCHIVED")
}

function isSelectedOrderRouting(routing: Route) {
  return routing.orderRoutingId === props.orderRoutingId
}

function getOrderRoutingStatusLabel(routing: Route) {
  return routing.statusId === "ROUTING_ACTIVE" ? translate("Active") : translate("Draft")
}

function isSameRoutingGroupRuleRoute(to: any) {
  return to.path.startsWith(`/brokering/${getRouteRoutingGroupId()}/`) && to.path.endsWith("/rules")
}

async function switchOrderRouting(routing: Pick<Route, "orderRoutingId">) {
  const orderRoutingId = routing?.orderRoutingId
  if(!orderRoutingId || orderRoutingId === props.orderRoutingId || isTestEnabled.value) {
    return;
  }

  await syncCurrentEditorDraftToStore()
  await orderRoutingStore().updateRoutingRuleId("")
  await orderRoutingStore().setCurrentOrderRouting(orderRoutingId)

  isSwitchingOrderRouting.value = true
  try {
    await router.push(`/brokering/${getRouteRoutingGroupId()}/${orderRoutingId}/rules`)
  } finally {
    isSwitchingOrderRouting.value = false
  }
}

async function createOrderRouteFromCanvas() {
  if(isTestEnabled.value) return;

  await syncCurrentEditorDraftToStore()
  return promptCreateRouting({
    routingGroupId: getRouteRoutingGroupId(),
    existingRoutings: getActiveAndDraftOrderRoutings(),
    onCreated: async (orderRoutingId) => {
      hasUnsavedChanges.value = true
      await switchOrderRouting({ orderRoutingId })
    }
  })
}

async function cloneRoutingFromCanvas(routing: Route) {
  if(isTestEnabled.value) return;

  await syncCurrentEditorDraftToStore()
  const orderRoutingId = await orderRoutingStore().cloneOrderRouting({
    orderRoutingId: routing.orderRoutingId,
    orderRoutingName: routing.routingName,
    routingGroupId: getRouteRoutingGroupId()
  })

  if(orderRoutingId) {
    hasUnsavedChanges.value = true
    await switchOrderRouting({ orderRoutingId })
  }
}

async function doOrderRoutingReorder(event: CustomEvent) {
  const previousSeq = getActiveAndDraftOrderRoutings()
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(previousSeq)));
  const updatedSequenceNums = previousSeq.map((routing: Route) => routing.sequenceNum)

  updatedSeq.forEach((routing: Route, index: number) => {
    routing.sequenceNum = updatedSequenceNums[index]
  })

  await syncCurrentEditorDraftToStore()
  const routings = commonUtil.sortSequence(updatedSeq.concat(getArchivedOrderRoutings()))
  await orderRoutingStore().setCurrentGroup({
    ...currentRoutingGroup.value,
    routings
  }, true)
  hasUnsavedChanges.value = true
}

async function openArchivedRoutingModal() {
  await syncCurrentEditorDraftToStore()
  const archivedRoutingModal = await modalController.create({
    component: ArchivedRoutingModal,
    componentProps: {
      archivedRoutings: getArchivedOrderRoutings(),
      saveRoutings: async (routings: any) => {
        if(routings) {
          const updatedRoutings = commonUtil.sortSequence(getActiveAndDraftOrderRoutings().concat(routings))
          await orderRoutingStore().setCurrentGroup({
            ...currentRoutingGroup.value,
            routings: JSON.parse(JSON.stringify(updatedRoutings))
          }, true)
          hasUnsavedChanges.value = true
        }
      }
    }
  })

  return archivedRoutingModal.present();
}

function loadReferenceDataInBackground() {
  Promise.allSettled([
    productStore().fetchFacilities(),
    useUtilStore().fetchOmsEnums({ enumTypeId: "ORDER_SALES_CHANNEL" }),
    productStore().fetchShippingMethods(),
    productStore().fetchFacilityGroups()
  ]).then((results) => {
    const rejected = results.find((result) => result.status === "rejected")
    if(rejected) {
      logger.warn(rejected.reason)
    }
  })
}

async function ensureCatalogCategories() {
  if(isCatalogCategoriesLoading || Object.keys(catalogCategories.value || {}).length) {
    return;
  }

  isCatalogCategoriesLoading = true
  try {
    await useUtilStore().fetchCategories()
  } finally {
    isCatalogCategoriesLoading = false
  }
}

async function loadCurrentRoutingEditor() {
  const requestId = ++routeLoadRequestId
  emitter.emit("presentLoader", { message: "Fetching filters and inventory rules", backdropDismiss: false })
  try {
    const routingGroupId = getRouteRoutingGroupId()
    // Fetching the group information again if the group stored in the state and the groupId in the route params are not same. This case occurs when we are on the route details page of a group and then directly hit the route details for a different group.
    if(routingGroupId && currentRoutingGroup.value.routingGroupId !== routingGroupId) {
      await orderRoutingStore().fetchCurrentRoutingGroup(routingGroupId)
    }
    await orderRoutingStore().fetchCurrentOrderRouting(props.orderRoutingId)
    orderRoutingStore().fetchRoutingHistory(routingGroupId)
    loadReferenceDataInBackground()

    if(requestId !== routeLoadRequestId) {
      return;
    }

    isRouteNameUpdating.value = false
    isRuleNameUpdating.value = false

    if(currentRouting.value["orderFilters"]?.length) {
      initializeOrderRoutingOptions()
    } else {
      clearOrderRoutingOptions()
    }

    // Added check to not fetch any rule related information as when a new route will be created no rule will be available thus no need to fetch any other information
    if(currentRouting.value["rules"]?.length) {
      inventoryRules.value = commonUtil.sortSequence(JSON.parse(JSON.stringify(currentRouting.value["rules"])))
      initializeInventoryRules()
      if(rulesForReorder.value.length) {
        const selectedRuleId = rulesForReorder.value.some((rule: Rule) => rule.routingRuleId === currentRuleId.value)
          ? currentRuleId.value
          : rulesForReorder.value[0].routingRuleId
        await fetchRuleInformation(selectedRuleId);
      } else {
        selectedRoutingRule.value = {}
        rulesInformation.value = {}
        inventoryRuleFilterOptions.value = {}
        inventoryRuleSortOptions.value = {}
        inventoryRuleActions.value = {}
      }
    } else {
      inventoryRules.value = []
      rulesForReorder.value = []
      selectedRoutingRule.value = {}
      rulesInformation.value = {}
      inventoryRuleFilterOptions.value = {}
      inventoryRuleSortOptions.value = {}
      inventoryRuleActions.value = {}
    }

    routeName.value = currentRouting.value["routingName"] ? currentRouting.value["routingName"] : ""
    routingStatus.value = currentRouting.value.statusId
    hasUnsavedChanges.value = Boolean(orderRoutingStore().hasUnsavedChanges)
  } catch(err) {
    logger.error(err)
    commonUtil.showToast(translate("Failed to load brokering run details"))
  } finally {
    emitter.emit("dismissLoader")
  }
}

onIonViewWillEnter(loadCurrentRoutingEditor)

watch(() => props.orderRoutingId, async (orderRoutingId, previousOrderRoutingId) => {
  if(orderRoutingId && orderRoutingId !== previousOrderRoutingId) {
    await loadCurrentRoutingEditor()
  }
})

// TODO: Need to revisit this, route entries are empty on router hooks
onBeforeRouteLeave(async (to) => {
  if(to.path === "/login") return;

  if(testRoutingInfo.value.currentOrderId) {
    return exitTestMode();
  }

  if(isSwitchingOrderRouting.value && isSameRoutingGroupRuleRoute(to)) {
    return;
  }

  if(!hasUnsavedChanges.value) {
    // clearning the selected ruleId whenever user tries to leave the page, we need to clear this id, as if user opens some other routing then the id will not be found which will result in an empty state scenario
    orderRoutingStore().updateRoutingRuleId( "")
    orderRoutingStore().clearRules()
    await updateUserTestSession();
    return;
  }

  const alert = await alertController.create({
    header: translate("Save changes"),
    message: translate("Do you want to save your changes before leaving this page?"),
    buttons: [
      {
        text: translate("Discard"),
        handler: async () => {
          await discardEditorChanges();
        }
      },
      {
        text: translate("Save"),
        handler: async () => {
          await save();
        },
      },
    ],
  });

  alert.present();
  const data = await alert.onDidDismiss()

  // If clicking backdrop just close the modal and do not redirect the user to previous page
  if(data?.role === "backdrop") {
    return false;
  }

  // clearning the selected ruleId whenever user leaves the page, we need to clear this id, as if user opens some other routing then the id will not be found which will result in an empty state scenario
  orderRoutingStore().updateRoutingRuleId( "")
  orderRoutingStore().clearRules()

  await updateUserTestSession();
  return;
})

async function discardEditorChanges() {
  hasUnsavedChanges.value = false
  await orderRoutingStore().discardCurrentGroupChanges(getRouteRoutingGroupId())
  await orderRoutingStore().setCurrentOrderRouting(props.orderRoutingId)
}

/*
When using ion-select inside ion-chip, if the user clicks on ion-chip and not on ion-select, the select popover does not open.
This happens because ionic does not provide any events for ion-chip OOTB.

Defined ref for specific select those are inside ion-chip and on clicking the chip, explicitely calling the click event of ion-select that triggers the select options to be displayed
*/
async function chipClickEvent(ref: any) {
  ref.$el.click();
}

async function exitTestMode() {
  // If the order is already in brokered state(means not brokered manually), then do not display the reset alert
  if(!testRoutingInfo.value.isOrderAlreadyBrokered && (testRoutingInfo.value.brokeringRoute || testRoutingInfo.value.brokeringRule)) {
    const alert = await alertController
      .create({
        header: translate("Reset order before leaving"),
        message: translate("Testing an order also allocates it to inventory in the OMS. Make sure to reset tested orders before trying another order or exiting test mode."),
        buttons: [{
          text: translate("Dismiss"),
          role: "cancel"
        }]
      });

    alert.present();
    return false; // passing boolean to let the routeLeave hook know to change the route or not
  }

  await orderRoutingStore().clearRoutingTestInfo()
  await updateUserTestSession();
  return true;
}

async function enableRoutingTest() {
  if(testRoutingInfo.value.isRoutingTestEnabled) {
    await updateUserTestSession();
  } else {
    await createUserTestSession();
  }

  if(testRoutingInfo.value.currentOrderId) {
    exitTestMode();
    return;
  }

  orderRoutingStore().updateRoutingTestInfo( [
    { key: "isRoutingTestEnabled", value: !testRoutingInfo.value.isRoutingTestEnabled },
    { key: "selectedRuleId", value: "" },
    { key: "unmatchedOrderFilters", value: [] }
  ])
}

async function enableRuleTest() {
  if(testRoutingInfo.value.isRuleTestEnabled) {
    await updateUserTestSession();
  } else {
    await createUserTestSession();
  }

  if(testRoutingInfo.value.currentOrderId) {
    exitTestMode();
    return;
  }

  orderRoutingStore().updateRoutingTestInfo( [
    { key: "isRuleTestEnabled", value: !testRoutingInfo.value.isRuleTestEnabled },
    { key: "selectedRuleId", value: "" },
    { key: "unmatchedOrderFilters", value: [] }
  ])
}

function getRouteIndex() {
  // Filtering archived routes as the index and total count needs to calculated by excluding the archived routes
  const activeAndDraftRoute = (currentRoutingGroup.value?.routings || []).filter((routing: any) => routing.statusId !== "ROUTING_ARCHIVED")
  const total = activeAndDraftRoute.length
  const currentRouteIndex = activeAndDraftRoute.findIndex((routing: any) => routing.orderRoutingId === props.orderRoutingId)

  if (!total || currentRouteIndex < 0) return `0/${total}`

  // adding one (1) as currentRouteIndex will have the index based on array, and used + as currentRouteIndex is a string
  return `${currentRouteIndex + 1}/${total}`
}

function getRuleIndex() {
  const total = rulesForReorder.value.length
  const currentRuleIndex: any = Object.keys(rulesForReorder.value).find((key: any) => rulesForReorder.value[key].routingRuleId == selectedRoutingRule.value.routingRuleId)

  // adding one (1) as currentRuleIndex will have the index based on array, and used + as currentRuleIndex is a string
  return `${+currentRuleIndex + 1}/${total}`
}

function getFacilityGroupsForBrokering(): any {
  return Object.values(facilityGroups.value)?.reduce((facilityGroups: any, group: any) => {
    if(group.facilityGroupTypeId === "BROKERING_GROUP") {
      facilityGroups[group.facilityGroupId] = group
    }
    return facilityGroups
  }, {})
}

function initializeOrderRoutingOptions() {
  const orderRouteFilters = commonUtil.sortSequence(JSON.parse(JSON.stringify(currentRouting.value["orderFilters"]))).reduce((filters: any, filter: any) => {
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

async function initializeInventoryRule(rule: any) {
  const inventoryRuleFilters = rule["inventoryFilters"] ? rule["inventoryFilters"] : {}

  inventoryRuleActions.value = rule["actions"] || {}
  inventoryRuleFilterOptions.value = inventoryRuleFilters["ENTCT_FILTER"] ? inventoryRuleFilters["ENTCT_FILTER"] : {}
  inventoryRuleSortOptions.value = inventoryRuleFilters["ENTCT_SORT_BY"] ? inventoryRuleFilters["ENTCT_SORT_BY"] : {}

  const actionTypes = ["ORA_NEXT_RULE", "ORA_MV_TO_QUEUE"]
  ruleActionType.value = Object.keys(inventoryRuleActions.value).find((actionId: string) => {
    return actionTypes.includes(actionId)
  }) || ""
}

async function editRouteName() {
  isRouteNameUpdating.value = !isRouteNameUpdating.value;
  // Waiting for DOM updations before focus inside the text-area, as it is conditionally rendered in the DOM
  await nextTick()
  routeNameRef.value.$el.setFocus();
}

async function updateRouteName() {
  if(routeName.value.trim() && routeName.value.trim() !== currentRouting.value.routingName.trim()) {
    const orderRoutingId = await orderRoutingStore().updateRouting({
      orderRoutingId: props.orderRoutingId,
      routingName: routeName.value.trim()
    });

    if(orderRoutingId) {
      routeName.value = routeName.value.trim()
      hasUnsavedChanges.value = true
    } else {
      routeName.value = currentRouting.value.routingName.trim()
    }
  }

  isRouteNameUpdating.value = false
}

async function fetchRuleInformation(routingRuleId: string, forceUpdate = false) {
  // Changing the value to false, as when fetching the information initially or after changing the rule we should stop the process of name updation
  isRuleNameUpdating.value = false

  await orderRoutingStore().updateRoutingRuleId( routingRuleId)

  // When clicking the same enum again do not fetch its information
  // TODO: check behaviour when creating a new rule, when no rule exist and when already some rule exist and a rule is open
  if(selectedRoutingRule.value.routingRuleId === routingRuleId && !forceUpdate) {
    return;
  }

  // Only fetch the rules information, if already not present, as we are updating rule values
  if(!rulesInformation.value[routingRuleId] || forceUpdate) {
    rulesInformation.value[routingRuleId] = await orderRoutingStore().fetchInventoryRuleInformation( routingRuleId)
  }

  // Using rulesForReorder object here, as we will update the change in rules only those are not archived
  selectedRoutingRule.value = rulesForReorder.value.find((rule: Rule) => rule.routingRuleId === routingRuleId)

  // If failed to fetch the current routing rule information
  if(!selectedRoutingRule.value || !rulesInformation.value[routingRuleId]?.routingRuleId) {
    selectedRoutingRule.value = {}
  }

  initializeInventoryRule(rulesInformation.value[routingRuleId] ? JSON.parse(JSON.stringify(rulesInformation.value[routingRuleId])) : {});
}

async function addInventoryFilterOptions(parentEnumId: string, conditionTypeEnumId: string, label = "") {
  if(!selectedRoutingRule.value.routingRuleId) {
    logger.error("Failed to identify selected inventory rule, please select a rule or refresh")
    return;
  }
  
  const inventoryFilterOptionsModal = await modalController.create({
    component: AddInventoryFilterOptionsModal,
    componentProps: { ruleConditions: conditionTypeEnumId === "ENTCT_FILTER" ? inventoryRuleFilterOptions.value : inventoryRuleSortOptions.value, routingRuleId: selectedRoutingRule.value.routingRuleId, parentEnumId, conditionTypeEnumId, label, filterOptions: inventoryRuleFilterOptions.value } // Passing filterOptions always as we need to make some sort options dependent on filters, so instead of updating the original flow, just passing the filter options always and will add the check on them.
  })

  inventoryFilterOptionsModal.onDidDismiss().then((result: any) => {
    // Using role to determine when to update the filters
    // When closing the modal without save and when unselecting all the filter, in both the cases we get filters object as empty thus passing a role from the modal to update the filter only when save action is performed
    if(result.role === "save") {
      conditionTypeEnumId === "ENTCT_FILTER" ? ( inventoryRuleFilterOptions.value = result.data.filters ) : ( inventoryRuleSortOptions.value = result.data.filters )
      updateRule()
    }
  })

  await inventoryFilterOptionsModal.present();
}

async function addOrderRouteFilterOptions(parentEnumId: string, conditionTypeEnumId: string, label = "") {
  const orderRouteFilterOptions = await modalController.create({
    component: AddOrderRouteFilterOptions,
    componentProps: { orderRoutingFilters: conditionTypeEnumId === "ENTCT_FILTER" ? orderRoutingFilterOptions.value : orderRoutingSortOptions.value, orderRoutingId: props.orderRoutingId, parentEnumId, conditionTypeEnumId, label }
  })

  orderRouteFilterOptions.onDidDismiss().then((result: any) => {
    // Using role to determine when to update the filters
    // When closing the modal without save and when unselecting all the filter, in both the cases we get filters object as empty thus passing a role from the modal to update the filter only when save action is performed
    if(result.role === "save") {
      conditionTypeEnumId === "ENTCT_FILTER" ? ( orderRoutingFilterOptions.value = result.data.filters ) : ( orderRoutingSortOptions.value = result.data.filters )
      hasUnsavedChanges.value = true
    }
  })

  await orderRouteFilterOptions.present();
}

async function openRoutingHistoryModal() {
  const routingHistoryModal = await modalController.create({
    component: RoutingHistoryModal,
    componentProps: { routingHistory: routingHistory.value[currentRouting.value.orderRoutingId], routingName: currentRouting.value.routingName, groupName: currentRoutingGroup.value.groupName }
  })

  routingHistoryModal.present();
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
    // Considering that when having role in result, its negative action and not need to do anything
    if(!result.role && ruleName) {
      // TODO: check for the default value of params
      const payload = {
        routingRuleId: "",
        orderRoutingId: props.orderRoutingId,
        ruleName,
        statusId: "RULE_DRAFT", // by default considering the rule to be in draft
        sequenceNum: inventoryRules.value.length && inventoryRules.value[inventoryRules.value.length - 1].sequenceNum >= 0 ? inventoryRules.value[inventoryRules.value.length - 1].sequenceNum + 5 : 0,  // added check for `>= 0` as sequenceNum can be 0, that will result in again setting the new route seqNum to 0,
        assignmentEnumId: "ORA_SINGLE", // by default, considering partial fulfillment to be inactive
        createdDate: DateTime.now().toMillis()
      }

      const routingRuleId = await orderRoutingStore().createRoutingRule( payload)
      if(routingRuleId) {
        // Updating the rule action to NEXT_RULE by default after creation
        await orderRoutingStore().updateRule( {
          routingRuleId,
          orderRoutingId: props.orderRoutingId,
          actions: [{
            actionTypeEnumId: "ORA_NEXT_RULE",
            actionValue: "",
            createdDate: DateTime.now().toMillis()
          }]
        })

        // If we archive/unarchive a rule and without saving the changes, creates a new rule then the changes in the rule status are lost.
        // Added the below logic to maintain the state of unarchived/archived rule when the status changes are not saved
        // and user creates a new rule
        const archivedRuleIds = getArchivedOrderRules()?.map((rule: Rule) => rule.routingRuleId)
        const activeRuleIds = inventoryRules.value.filter((rule: Rule) => rule.statusId === "RULE_ACTIVE")?.map((rule: Rule) => rule.routingRuleId)
        const draftRuleIds = inventoryRules.value.filter((rule: Rule) => rule.statusId === "RULE_DRAFT")?.map((rule: Rule) => rule.routingRuleId)
        // TODO: Fix warning of duplicate keys when creating a new rule
        const routingRules = JSON.parse(JSON.stringify(currentRouting.value["rules"]))
        routingRules.map((rule: any) => {
          if(archivedRuleIds.includes(rule.routingRuleId)) {
            rule.statusId = "RULE_ARCHIVED"
          }

          if(activeRuleIds.includes(rule.routingRuleId)) {
            rule.statusId = "RULE_ACTIVE"
          }

          if(draftRuleIds.includes(rule.routingRuleId)) {
            rule.statusId = "RULE_DRAFT"
          }
        })

        inventoryRules.value = commonUtil.sortSequence(routingRules)
        initializeInventoryRules()
        hasUnsavedChanges.value = true
        fetchRuleInformation(routingRuleId)
      }
    }
  })

  return newRuleAlert.present();
}

function isFacilityGroupSelected(facilityGroupId: string, type: string) {
  if(type === "excluded") {
    return facilityGroupId == getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, 'FACILITY_GROUP')?.fieldValue
  } else {
    return facilityGroupId == getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED')?.fieldValue
  }
}

// When changing the selected rule, updating any changes made in filter, sort and actions of the current rule
function updateRule() {
  rulesInformation.value[selectedRoutingRule.value.routingRuleId]["inventoryFilters"] = { "ENTCT_FILTER": inventoryRuleFilterOptions.value, "ENTCT_SORT_BY": inventoryRuleSortOptions.value }
  rulesInformation.value[selectedRoutingRule.value.routingRuleId]["actions"] = inventoryRuleActions.value
  hasUnsavedChanges.value = true
}

function updateOrderRouting(value: string) {
  routingStatus.value = value
  hasUnsavedChanges.value = true
}

function updateUnfillableActionType(value: string) {
  const actionType = ruleActionType.value
  ruleActionType.value = value

  inventoryRuleActions.value[ruleActionType.value] = {
    actionTypeEnumId: value,
    actionValue: "", // after changing action type, as next_rule action does not need to have a value, so in all cases making intially the value as empty and will update if required from some other function
    createdDate: DateTime.now().toMillis()
  }
  // deleting previous action type, but using the data of previous action
  delete inventoryRuleActions.value[actionType]
  updateRule()
}

function updateRuleActionValue(value: string) {
  if(inventoryRuleActions.value[ruleActionType.value]) {
    inventoryRuleActions.value[ruleActionType.value]["actionValue"] = value
  } else {
    inventoryRuleActions.value = {
      ...inventoryRuleActions.value,
      [ruleActionType.value]: {
        actionValue: value
      }
    }
  }
  updateRule()
}

async function removeAutoCancelDays() {
  delete inventoryRuleActions.value[actionEnums["AUTO_CANCEL_DAYS"].id]
  updateRule()
}

async function updateAutoCancelDays() {
  const alert = await alertController.create({
    header: translate("Auto cancel days"),
    inputs: [{
      name: "autoCancelDays",
      placeholder: translate("auto cancel days"),
      type: "number",
      min: 0,
      value: inventoryRuleActions.value[actionEnums["AUTO_CANCEL_DAYS"].id]?.actionValue,
      attributes: {
        // Added check to not allow mainly .(period) and other special characters to be entered in the alert input
        onkeydown: ($event: any) => {
          if(/[`!@#$%^&*()_+\-=\\|,.<>?~]/.test($event.key)) $event.preventDefault();
        }
      }
    }],
    buttons: [{
      text: translate("Cancel"),
      role: "cancel"
    },
    {
      text: translate("Save"),
      handler: (data) => {
        // Added check for `>= 0` as we not need to allow negative values for autoCancelDays value
        if(data?.autoCancelDays && data.autoCancelDays >= 0) {
          if(inventoryRuleActions.value[actionEnums["AUTO_CANCEL_DAYS"].id]?.actionValue) {
            inventoryRuleActions.value[actionEnums["AUTO_CANCEL_DAYS"].id].actionValue = data.autoCancelDays
          } else {
            inventoryRuleActions.value[actionEnums["AUTO_CANCEL_DAYS"].id] = {
              actionTypeEnumId: actionEnums["AUTO_CANCEL_DAYS"].id,
              actionValue: data.autoCancelDays,
              createdDate: DateTime.now().toMillis(),
            }
          }
        } else {
          commonUtil.showToast(translate("Enter a valid value"))
          return false;
        }
        updateRule()
      }
    }]
  })
  await alert.present()
}

function updatePartialAllocation(checked: any) {
  inventoryRules.value.map((inventoryRule: any) => {
    if(inventoryRule.routingRuleId === selectedRoutingRule.value.routingRuleId) {
      // Updating selected routing rule explicitely as we are using rulesForReorder for fetching selected values
      inventoryRule.assignmentEnumId = selectedRoutingRule.value.assignmentEnumId = checked ? "ORA_MULTI" : "ORA_SINGLE"

      // When enabling partial allocation, updating the value of partial group item allocation by default,
      // as when partial allocation is enabled we are saying to partial allocate all items of orders thus need to make
      // group items allocation enabled as well in this case.
      updatePartialGroupItemsAllocation(checked)
    }
  })
  hasUnsavedChanges.value = true
}

function isInventoryRuleFiltersApplied() {
  const ruleFilters = Object.keys(inventoryRuleFilterOptions.value).filter((rule: string) => rule !== conditionFilterEnums["SPLIT_ITEM_GROUP"].code);
  return ruleFilters.length
}

function isPromiseDateFilterApplied() {
  if(!currentRouting.value["rules"]?.length) {
    return;
  }

  const filter = getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE")
    || getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE_EXCLUDED")
  return filter?.fieldValue || filter?.fieldValue == 0
}

function getPromiseDateValue(parameter: "PROMISE_DATE" | "PROMISE_DATE_EXCLUDED" = "PROMISE_DATE") {
  const value = getFilterValue(orderRoutingFilterOptions.value, ruleEnums, parameter)?.fieldValue
  if(value || value == 0) {
    const promiseDateValue = String(value)
    return promiseDateValue == "0" ? translate("already passed") : promiseDateValue.startsWith("-") ? `${promiseDateValue.replace("-", "")} days passed` : `upcoming in ${promiseDateValue} days`
  }
  return translate("select range")
}

function getFilterValue(options: any, enums: any, parameter: string) {
  return enums[parameter] ? options?.[enums[parameter].code] : undefined
}

function getSelectedValue(options: any, enumerations: any, parameter: string) {
  let value = options?.[enumerations[parameter].code].fieldValue

  // Initially when adding a filter no value is selected thus returning empty string
  if(!value) {
    return "";
  }

  value = value?.split(',')

  // If having more than 1 value selected then displaying the count of selected value otherwise returning the facilityName of the selected facility
  if(value?.length > 1) {
    return `${value.length} ${translate("selected")}`
  } else {
    return parameter === "SHIPPING_METHOD" || parameter === "SHIPPING_METHOD_EXCLUDED" ? shippingMethods.value[value[0]]?.description || value[0] : parameter === "SALES_CHANNEL" || parameter === "SALES_CHANNEL_EXCLUDED" ? enums.value["ORDER_SALES_CHANNEL"] ? enums.value["ORDER_SALES_CHANNEL"][value[0]]?.description : value[0] : parameter === "ORIGIN_FACILITY_GROUP" || parameter === "ORIGIN_FACILITY_GROUP_EXCLUDED" || parameter === "FACILITY_GROUP" || parameter === "FACILITY_GROUP_EXCLUDED" ? facilityGroups.value[value[0]]?.facilityGroupName || value[0] : facilities.value[value[0]]?.facilityName || value[0]
  }
}

function getLabel(parentType: string, code: string) {
  const enumerations = enums.value[parentType]
  const enumInfo: any = enumerations ? Object.values(enumerations).find((enumeration: any) => enumeration.enumCode === code) : null

  return enumInfo?.description
}

async function selectPromiseFilterValue(ev: CustomEvent, type = "included") {
  const popover = await popoverController
    .create({
      component: PromiseFilterPopover,
      componentProps: {
        value: getFilterValue(orderRoutingFilterOptions.value, ruleEnums, type === "excluded" ? "PROMISE_DATE_EXCLUDED" : "PROMISE_DATE").fieldValue
      },
      event: ev,
      translucent: true,
      showBackdrop: true
    })

  popover.onDidDismiss().then((result: any) => {
    if(result.data?.duration || result.data?.duration == 0) {
      getFilterValue(orderRoutingFilterOptions.value, ruleEnums, type === "excluded" ? "PROMISE_DATE_EXCLUDED" : "PROMISE_DATE").fieldValue = result.data?.isPastDuration ? `-${result.data?.duration}` : result.data?.duration
      // Making partial allocation value to `MULTI` when applying promise date filter
      updatePartialAllocation(true);
      hasUnsavedChanges.value = true

      // When selecting promiseDate route filter value, we also need to enable partial allocation and make its value change on the server
      updatePartialAllocation(true);
    }
    getFilterValue(orderRoutingFilterOptions.value, ruleEnums, type === "excluded" ? "PROMISE_DATE_EXCLUDED" : "PROMISE_DATE").operator = type === "excluded" ? "not-equals" : "less-equals"
  })

  return popover.present();
}

async function selectValue(id: string, header: string, operator = "equals") {
  const filter = getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, id)
  const valueAlert = await alertController.create({
    header,
    buttons: [{
      text: translate("Cancel"),
      role: "cancel"
    }, {
      text: translate("Save")
    }],
    inputs: [{
      name: "value",
      placeholder: translate("value"),
      value: filter.fieldValue
    }]
  })

  valueAlert.onDidDismiss().then(async (result: any) => {
    const value = result.data?.values?.value;
    // Considering that when having role in result, its negative action and not need to do anything
    if(!result.role && value) {
      filter.fieldValue = value
      // When selecting a filter value making the operator to default `equals` if not present already
      // For proximity filter we need to have less-equals as operator
      filter.operator = (id === "PROXIMITY" ? "less-equals" : filter.operator || operator)
      updateRule()
    }
  })

  return valueAlert.present();
}

function updateOperator(event: CustomEvent) {
  getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, "BRK_SAFETY_STOCK").operator = event.detail.value
  updateRule()
}

function updateOrderFilterValue(event: CustomEvent, id: string, multi = false) {
  let value = event.detail.value
  let operator = id.includes("_EXCLUDED") ? "not-equals" : "equals"
  // When the filter has multiple selection support then we will receive an array in the event value and thus creating a string before updating the same as the fieldValue supports a string as value
  if(multi && value.length > 1) {
    value = value.join(',')
    operator = id.includes("_EXCLUDED") ? "not-in" : "in"
  } else if(multi) {
    // When filter is having a single option selected with multiple selection enabled, we will receive an array with single value, but as we need to pass a string, so fetching the 0th index from the array
    value = value[0]
  }

  orderRoutingFilterOptions.value[ruleEnums[id].code].fieldValue = value
  orderRoutingFilterOptions.value[ruleEnums[id].code].operator = operator
  hasUnsavedChanges.value = true
}

function updateRuleFilterValue(event: CustomEvent, id: string) {
  if(id === "FACILITY_ORDER_LIMIT") {
    inventoryRuleFilterOptions.value[conditionFilterEnums[id].code].fieldValue = event.detail.checked ? "Y" : "N"
  } else {
    inventoryRuleFilterOptions.value[conditionFilterEnums[id].code].fieldValue = event.detail.value
  }
  updateRule()
}

function clearAutoCancelDays(checked: any) {
  if(inventoryRuleActions.value[actionEnums["RM_AUTO_CANCEL_DATE"].id]) {
    inventoryRuleActions.value[actionEnums["RM_AUTO_CANCEL_DATE"].id].actionValue = checked
  } else {
    inventoryRuleActions.value = {
      ...inventoryRuleActions.value,
      [actionEnums["RM_AUTO_CANCEL_DATE"].id]: {
        actionValue: checked,
        actionTypeEnumId: actionEnums["RM_AUTO_CANCEL_DATE"].id,
        createdDate: DateTime.now().toMillis()
      }
    }
  }

  updateRule()
}

// Updating rule status
function updateRuleStatus(event: CustomEvent, routingRuleId: string) {
  inventoryRules.value.map((inventoryRule: any) => {
    if(inventoryRule.routingRuleId === routingRuleId) {
      inventoryRule.statusId = event.detail.value
    }
  })

  // When archiving a rule, we do not want that rule details to be dispalyed any more thus clearing selectedRoutingRule
  if(event.detail.value === "RULE_ARCHIVED") {
    selectedRoutingRule.value = {}
  }

  hasUnsavedChanges.value = true
  initializeInventoryRules()
}

async function editRuleName() {
  isRuleNameUpdating.value = !isRuleNameUpdating.value;
  // Waiting for DOM updations before focus inside the text-area, as it is conditionally rendered in the DOM
  await nextTick()
  ruleNameRef.value.$el.setFocus();
}

async function updateRuleName(routingRuleId: string) {
  let isUpdateRequired = false;

  currentRouting.value["rules"].map((inventoryRule: any) => {
    if(inventoryRule.routingRuleId === routingRuleId && inventoryRule.ruleName.trim() !== selectedRoutingRule.value.ruleName.trim()) {
      isUpdateRequired = true
    }
  })

  if(isUpdateRequired) {
    const ruleName = selectedRoutingRule.value.ruleName.trim()
    inventoryRules.value.forEach((inventoryRule: any) => {
      if(inventoryRule.routingRuleId === routingRuleId) {
        inventoryRule.ruleName = ruleName
      }
    })
    rulesForReorder.value.forEach((inventoryRule: any) => {
      if(inventoryRule.routingRuleId === routingRuleId) {
        inventoryRule.ruleName = ruleName
      }
    })
    if(rulesInformation.value[routingRuleId]) {
      rulesInformation.value[routingRuleId].ruleName = ruleName
    }
    selectedRoutingRule.value.ruleName = ruleName
    hasUnsavedChanges.value = true
  }

  isRuleNameUpdating.value = false
}

async function cloneRule() {
  emitter.emit("presentLoader", { message: `Cloning ${selectedRoutingRule.value.ruleName}`, backdropDismiss: false })

  try {
    const resp = await orderRoutingStore().cloneRule({
      routingRuleId: selectedRoutingRule.value.routingRuleId,
      newOrderRoutingId: props.orderRoutingId,
      newRuleName: `${selectedRoutingRule.value.ruleName} copy`
    })

    if(commonUtil.hasError(resp) || !resp.data.newRoutingRuleId) {
      throw resp.data
    }

    await orderRoutingStore().fetchCurrentOrderRouting( props.orderRoutingId)
  } catch (err) {
    logger.error(err)
    commonUtil.showToast(translate("Failed to clone rule"))
  }

  emitter.emit("dismissLoader")
}

function doRouteSortReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(Object.values(orderRoutingSortOptions.value)))

  // returns the updated sequence after reordering
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(Object.values(orderRoutingSortOptions.value))));

  const updatedSeqenceNum = Object.keys(previousSeq).map((filter: any) => previousSeq[filter].sequenceNum)
  Object.keys(updatedSeq).map((key: any, index: number) => {
    updatedSeq[key].sequenceNum = updatedSeqenceNum[index]
  })

  orderRoutingSortOptions.value = updatedSeq.reduce((filters: any, filter: any) => {
    filters[filter.fieldName] = filter
    return filters
  }, {})

  // considering that on reordering there is some change in the order
  hasUnsavedChanges.value = true
}

function doConditionSortReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(Object.values(inventoryRuleSortOptions.value)))

  // returns the updated sequence after reordering
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(Object.values(inventoryRuleSortOptions.value))));

  const updatedSeqenceNum = Object.keys(previousSeq).map((filter: any) => previousSeq[filter].sequenceNum)
  Object.keys(updatedSeq).map((key: any, index: number) => {
    updatedSeq[key].sequenceNum = updatedSeqenceNum[index]
  })

  inventoryRuleSortOptions.value = updatedSeq.reduce((filters: any, filter: any) => {
    filters[filter.fieldName] = filter
    return filters
  }, {})

  updateRule()
}

function findRulesDiff(previousSeq: any, updatedSeq: any) {
  const diffSeq: any = Object.keys(previousSeq).reduce((diff, key) => {
    if (updatedSeq[key].routingRuleId === previousSeq[key].routingRuleId && updatedSeq[key].statusId === previousSeq[key].statusId && updatedSeq[key].assignmentEnumId === previousSeq[key].assignmentEnumId && updatedSeq[key].ruleName === previousSeq[key].ruleName && updatedSeq[key].sequenceNum === previousSeq[key].sequenceNum) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, {})
  return diffSeq;
}

function findSortDiff(previousSeq: any, updatedSeq: any) {
  let seqToUpdate = {} as any
  let seqToRemove = {} as any

  seqToUpdate = Object.keys(previousSeq).reduce((diff, key) => {
    if(!updatedSeq[key]) {
      seqToRemove[key] = previousSeq[key]
      return diff
    }

    if (updatedSeq[key].fieldName === previousSeq[key].fieldName && updatedSeq[key].sequenceNum === previousSeq[key].sequenceNum) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, seqToUpdate)

  seqToUpdate = Object.keys(updatedSeq).reduce((diff, key) => {
    if(!previousSeq[key]) {
      diff = {
        ...diff,
        [key]: updatedSeq[key]
      }
    }

    return diff
  }, seqToUpdate)

  // Updated the keys of the object as there are some cases in which the field is same for both filter and sort options thus causing issue when doing same kind operation (addtion or deletion) of fields
  seqToUpdate = Object.keys(seqToUpdate).reduce((updatedSeq: any, key) => {
    updatedSeq[key + '_sort'] = seqToUpdate[key]
    return updatedSeq
  }, {})

  seqToRemove = Object.keys(seqToRemove).reduce((updatedSeq: any, key) => {
    updatedSeq[key + '_sort'] = seqToRemove[key]
    return updatedSeq
  }, {})

  return { seqToUpdate, seqToRemove };
}

function findFilterDiff(previousSeq: any, updatedSeq: any) {
  let seqToUpdate = {} as any
  let seqToRemove = {} as any

  seqToUpdate = Object.keys(previousSeq).reduce((diff, key) => {
    if(!updatedSeq[key]) {
      seqToRemove[key] = previousSeq[key]
      return diff
    }

    // Not using strict equality comparison for fieldValue as for some filters the type of value returned from server and the updated value from the app will not be the same(ex. Promise date filter)
    if (updatedSeq[key].fieldName === previousSeq[key].fieldName && updatedSeq[key].fieldValue == previousSeq[key].fieldValue && updatedSeq[key].operator === previousSeq[key].operator) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, seqToUpdate)

  seqToUpdate = Object.keys(updatedSeq).reduce((diff, key) => {
    // Added fieldValue check as we have considered that when adding a filter option, it should always have a value, and added check for zero, as in some filters value as 0 is possible
    if(!previousSeq[key] && (updatedSeq[key].fieldValue || updatedSeq[key].fieldValue === 0)) {
      diff = {
        ...diff,
        [key]: updatedSeq[key]
      }
    }

    return diff
  }, seqToUpdate)

  // Updated the keys of the object as there are some cases in which the field is same for both filter and sort options thus causing issue when doing same kind operation (addtion or deletion) of fields
  seqToUpdate = Object.keys(seqToUpdate).reduce((updatedSeq: any, key) => {
    updatedSeq[key + '_filter'] = seqToUpdate[key]
    return updatedSeq
  }, {})

  seqToRemove = Object.keys(seqToRemove).reduce((updatedSeq: any, key) => {
    updatedSeq[key + '_filter'] = seqToRemove[key]
    return updatedSeq
  }, {})

  return { seqToUpdate, seqToRemove };
}

function findActionDiff(previousSeq: any, updatedSeq: any) {
  let seqToUpdate = {}
  let seqToRemove = {} as any

  seqToUpdate = Object.keys(previousSeq).reduce((diff, key) => {
    if(!updatedSeq[key]) {
      seqToRemove[key] = previousSeq[key]
      return diff
    }

    // Not using strict equality comparison for actionValue as for some filters the type of value returned from server and the updated value from the app will not be the same.
    if (updatedSeq[key].actionTypeEnumId === previousSeq[key].actionTypeEnumId && updatedSeq[key].actionValue == previousSeq[key].actionValue) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, seqToUpdate)

  seqToUpdate = Object.keys(updatedSeq).reduce((diff, key) => {
    if(!previousSeq[key]) {
      diff = {
        ...diff,
        [key]: updatedSeq[key]
      }
    }

    return diff
  }, seqToUpdate)

  return { seqToUpdate, seqToRemove };
}

function doReorder(event: CustomEvent) {
  const previousSeq = JSON.parse(JSON.stringify(rulesForReorder.value))

  // returns the updated sequence after reordering
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(rulesForReorder.value)));

  let diffSeq = findRulesDiff(previousSeq, updatedSeq)

  const updatedSeqenceNum = previousSeq.map((rule: Rule) => rule.sequenceNum)
  Object.keys(diffSeq).map((key: any) => {
    diffSeq[key].sequenceNum = updatedSeqenceNum[key]
  })

  diffSeq = Object.keys(diffSeq).map((key) => diffSeq[key])

  rulesForReorder.value = updatedSeq

  // Once the reordering is completed then update the original rules array with the updated sequenceNum
  // This is required as we will find a final diff of rules before saving changes
  inventoryRules.value.map((rule: Rule) => {
    const updatedRule = updatedSeq.find((seq: any) => seq.routingRuleId === rule.routingRuleId)
    if(updatedRule) {
      rule.sequenceNum = updatedRule.sequenceNum
    }
  })

  hasUnsavedChanges.value = true
}

async function save() {
  emitter.emit("presentLoader", { message: "Updating inventory rules and filters", backdropDismiss: false })
  try {
    syncSelectedRuleDraftForSave()
    const selectedRuleId = selectedRoutingRule.value?.routingRuleId || currentRuleId.value
    const selectedRuleName = selectedRoutingRule.value?.ruleName || ""
    const payload = buildRoutingGroupEditorSavePayload({
      group: currentRoutingGroup.value,
      orderRoutingId: props.orderRoutingId,
      routingPatch: {
        routingName: routeName.value || currentRouting.value.routingName,
        statusId: routingStatus.value
      },
      orderRoutingFilterOptions: orderRoutingFilterOptions.value,
      orderRoutingSortOptions: orderRoutingSortOptions.value,
      inventoryRules: inventoryRules.value,
      rulesInformation: rulesInformation.value,
      descendingSortFields: import.meta.env.VITE_FILTER_SORT_DESC || ""
    })

    await orderRoutingStore().saveRoutingGroupRaw(payload)
    await orderRoutingStore().fetchCurrentOrderRouting(props.orderRoutingId)

    currentRouting.value["orderFilters"]?.length ? initializeOrderRoutingOptions() : clearOrderRoutingOptions()

    if(currentRouting.value["rules"]?.length) {
      inventoryRules.value = commonUtil.sortSequence(JSON.parse(JSON.stringify(currentRouting.value["rules"])))
      initializeInventoryRules()
      const nextRule = findRuleAfterSave(selectedRuleId, selectedRuleName)
      if(nextRule?.routingRuleId) {
        await fetchRuleInformation(nextRule.routingRuleId, true)
      } else {
        selectedRoutingRule.value = {}
        rulesInformation.value = {}
      }
    } else {
      inventoryRules.value = []
      rulesForReorder.value = []
      selectedRoutingRule.value = {}
      rulesInformation.value = {}
      inventoryRuleFilterOptions.value = {}
      inventoryRuleSortOptions.value = {}
      inventoryRuleActions.value = {}
    }

    hasUnsavedChanges.value = false
    commonUtil.showToast(translate("Changes saved successfully"))
  } catch(err) {
    commonUtil.showToast(translate("Failed to save routing changes"))
    logger.error(err)
  } finally {
    emitter.emit("dismissLoader")
  }
}

function syncSelectedRuleDraftForSave() {
  const ruleId = selectedRoutingRule.value?.routingRuleId
  if(!ruleId) return

  rulesInformation.value[ruleId] = {
    ...(rulesInformation.value[ruleId] || {}),
    ...selectedRoutingRule.value,
    inventoryFilters: {
      ENTCT_FILTER: inventoryRuleFilterOptions.value,
      ENTCT_SORT_BY: inventoryRuleSortOptions.value
    },
    actions: inventoryRuleActions.value
  }
}

function clearOrderRoutingOptions() {
  orderRoutingFilterOptions.value = {}
  orderRoutingSortOptions.value = {}
}

function findRuleAfterSave(ruleId: string, ruleName: string) {
  return rulesForReorder.value.find((rule: Rule) => rule.routingRuleId === ruleId)
    || rulesForReorder.value.find((rule: Rule) => rule.ruleName === ruleName)
    || rulesForReorder.value[0]
}

function updatePartialGroupItemsAllocation(checked: boolean) {
  if(inventoryRuleFilterOptions.value[conditionFilterEnums["SPLIT_ITEM_GROUP"].code]){
    inventoryRuleFilterOptions.value[conditionFilterEnums["SPLIT_ITEM_GROUP"].code].fieldValue = checked ? 'Y' : 'N'
  } else {
    inventoryRuleFilterOptions.value[conditionFilterEnums["SPLIT_ITEM_GROUP"].code] = {
      routingRuleId: selectedRoutingRule.value.routingRuleId,
      conditionTypeEnumId: "ENTCT_FILTER",
      fieldName: conditionFilterEnums["SPLIT_ITEM_GROUP"].code,
      fieldValue: checked ? "Y" : "N",
      sequenceNum: Object.keys(inventoryRuleFilterOptions.value).length && inventoryRuleFilterOptions.value[Object.keys(inventoryRuleFilterOptions.value)[Object.keys(inventoryRuleFilterOptions.value).length - 1]]?.sequenceNum >= 0 ? inventoryRuleFilterOptions.value[Object.keys(inventoryRuleFilterOptions.value)[Object.keys(inventoryRuleFilterOptions.value).length - 1]].sequenceNum + 5 : 0,
      createdDate: DateTime.now().toMillis()
    }
  }
  updateRule()
}

function isPartialGroupItemsAllocationActive() {
  return inventoryRuleFilterOptions.value[conditionFilterEnums["SPLIT_ITEM_GROUP"].code]?.fieldValue === 'Y';
}

function initializeInventoryRules() {
  // Sorting the sequence once again here, as after making some changes in the rules like status, enumId etc
  // the original reordered sequence is lost thus before updating the variable sorting it first and then saving changes
    rulesForReorder.value = commonUtil.sortSequence(JSON.parse(JSON.stringify(getActiveAndDraftOrderRules())))
}

function getActiveAndDraftOrderRules() {
  return inventoryRules.value.filter((rule: Rule) => rule.statusId !== "RULE_ARCHIVED")
}

function getArchivedOrderRules() {
  return inventoryRules.value.filter((rule: Rule) => rule.statusId === "RULE_ARCHIVED")
}

async function openArchivedRuleModal() {
  const archivedRuleModal = await modalController.create({
    component: ArchivedRuleModal,
    componentProps: {
      archivedRules: getArchivedOrderRules(),
      // Passed a function as prop to update the rules whenever rule is unarchived from a modal
      saveRules: (rules: any) => {
        if(rules) {
          hasUnsavedChanges.value = true
          inventoryRules.value = commonUtil.sortSequence(getActiveAndDraftOrderRules().concat(rules))
        }
        initializeInventoryRules()
      }
    }
  })

  archivedRuleModal.present();
}

async function getUserTestSession() {
  userTestingSession.value = await useUtilStore().getUserSession({
    customParametersMap: {
      sessionTypeEnumId: "ROUTING_TEST_DRIVE",
      userId: userProfile.value.userId,
      productStoreId: currentEComStore.value.productStoreId
    },
    selectedEntity: "co.hotwax.user.UserSession",
    pageLimit: 100,
    filterByDate: true
  });
}

async function createUserTestSession() {
  await getUserTestSession();

  // If a test session already exists for the user do not create a new one
  if(userTestingSession.value.userSessionId) {
    return;
  }

  userTestingSession.value = await useUtilStore().createUserSession({
    sessionTypeEnumId: "ROUTING_TEST_DRIVE",
    userId: userProfile.value.userId,
    productStoreId: currentEComStore.value.productStoreId,
    fromDate: DateTime.now().toMillis()
  });
}

async function updateUserTestSession() {
  if(!userTestingSession.value.userSessionId) {
    return;
  }

  userTestingSession.value = await useUtilStore().expireUserSession({
    sessionTypeEnumId: "ROUTING_TEST_DRIVE",
    userId: userProfile.value.userId,
    userSessionId: userTestingSession.value.userSessionId,
    productStoreId: currentEComStore.value.productStoreId,
    thruDate: DateTime.now().toMillis()
  });
}
</script>

<style scoped>
ion-content > main, #inventory-rules {
  display: grid;
  grid-template-columns: minmax(375px, 25%) 1fr;
  height: 100%;
  container-type: inline-size;
}

/* The right-hand column of #inventory-rules holds the rule-info / filters / actions cards.
   Make each direct child its own inline-size container so the cards collapse independently
   when the column gets narrow (e.g. side menu open on a laptop). */
#inventory-rules > :not(#inventory-sequence) {
  container-type: inline-size;
  min-width: 0;
}

.rule-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;
  gap: var(--spacer-xs);
}

.filters {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  align-items: start;
}

ion-modal.simulation-workspace-modal {
  --width: min(1220px, 96vw);
  --height: 92vh;
}

.actions {
  max-width: 50%;
}

/* Collapse the two-column card grids to a single column when their container is narrow.
   600px chosen so two ~280px cards plus gap can comfortably sit side-by-side above it. */
@container (max-width: 600px) {
  .rule-info,
  .filters {
    grid-template-columns: 1fr;
  }

  .actions {
    max-width: 100%;
  }
}

/* Viewport fallback for browsers without container query support, and for the parent
   #inventory-rules grid itself (which can't size against its own container). */
@media (max-width: 991px) {
  ion-content > main,
  #inventory-rules {
    grid-template-columns: 1fr;
  }

  .rule-info,
  .filters {
    grid-template-columns: 1fr;
  }

  .actions {
    max-width: 100%;
  }

  .menu {
    border-right: none;
    border-bottom: 1px solid var(--ion-color-medium);
  }
}

.menu {
  border-right: 1px solid var(--ion-color-medium);
}

#inventory-sequence {
  text-align: center;
}

ion-chip > ion-select {
  /* Adding min-height as auto-styling is getting appLied when not using legacy select option */
  min-height: unset;
}

.empty-state {
  text-align: center;
  margin: 0;
}

.selected-rule {
  box-shadow: 0px 8px 10px 0px rgba(0, 0, 0, 0.14), 0px 3px 14px 0px rgba(0, 0, 0, 0.12), 0px 4px 5px 0px rgba(0, 0, 0, 0.20);
  scale: 1.03;
  margin-block: var(--spacer-sm);
}

.rule-item {
  transition: scale .5s ease, box-shadow .5s ease;
}

@media (max-width: 991px) {
  ion-content > main {
    grid-template-columns: repeat(3, minmax(375px, 375px));
    overflow-x: auto;
    overflow-y: hidden;
  }

  ion-content > main > .menu,
  #inventory-sequence,
  #inventory-rules > :not(#inventory-sequence) {
    min-height: 100%;
    max-height: 100%;
    overflow-y: auto;
  }

  #inventory-rules {
    display: contents;
  }

  #inventory-sequence {
    grid-column: 2;
  }

  #inventory-rules > :not(#inventory-sequence) {
    grid-column: 3;
  }

  .menu {
    border-bottom: none;
  }
}

ion-content > main.routing-detail-canvas {
  grid-template-columns: minmax(280px, 320px) minmax(375px, 375px) minmax(320px, 360px) minmax(640px, 1fr);
  overflow-x: auto;
  overflow-y: hidden;
}

ion-content > main.routing-detail-canvas > #inventory-rules {
  display: contents;
}

ion-content > main.routing-detail-canvas > .routing-context-column,
ion-content > main.routing-detail-canvas > #order-filters,
ion-content > main.routing-detail-canvas #inventory-sequence,
ion-content > main.routing-detail-canvas #inventory-rules > :not(#inventory-sequence) {
  min-height: 100%;
  max-height: 100%;
  overflow-y: auto;
}

ion-content > main.routing-detail-canvas #inventory-sequence {
  grid-column: 3;
}

ion-content > main.routing-detail-canvas #inventory-rules > :not(#inventory-sequence) {
  grid-column: 4;
  min-width: 640px;
}

@media (max-width: 991px) {
  ion-content > main.routing-detail-canvas {
    grid-template-columns: repeat(4, minmax(320px, 375px));
  }

  ion-content > main.routing-detail-canvas #inventory-sequence {
    grid-column: 3;
  }

  ion-content > main.routing-detail-canvas #inventory-rules > :not(#inventory-sequence) {
    grid-column: 4;
    min-width: 320px;
  }
}
</style>
