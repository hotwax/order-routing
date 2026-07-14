<template>
  <div v-if="isLoadingGroup && !group?.routingGroupId" class="canvas-loading">
    <ion-spinner name="crescent" />
  </div>
  <div class="routing-group-editor" v-else-if="group?.routingGroupId">
    <!-- Routing Group Column -->
    <div class="routing-group">
      <ion-card class="info">
        <div>
          <ion-card-header>
            <ion-card-title v-show="!isGroupNameUpdating">{{ groupName }}</ion-card-title>
            <ion-input ref="groupNameRef" :class="isGroupNameUpdating ? 'name' : ''" v-show="isGroupNameUpdating" aria-label="group name" v-model="groupName"></ion-input>
            <ion-card-subtitle>{{ group.routingGroupId }}</ion-card-subtitle>
            <p v-show="!isDescUpdating && group.description" class="group-description">{{ group.description }}</p>
            <ion-textarea v-show="isDescUpdating" ref="descRef" class="group-description-input" aria-label="description" :auto-grow="true" v-model="description" @keydown.enter.exact.prevent="updateGroupDescription()"></ion-textarea>
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
            <ion-button v-show="!isDescUpdating" fill="outline" size="small" @click="editGroupDescription()">
              <ion-icon slot="start" :icon="group.description ? pencilOutline : addCircleOutline" />
              {{ group.description ? translate("Edit description") : translate("Add description") }}
            </ion-button>
            <ion-button v-show="isDescUpdating" fill="outline" size="small" @click="updateGroupDescription()">
              <ion-icon slot="start" :icon="saveOutline" />
              {{ translate("Save description") }}
            </ion-button>
            <ion-button v-if="!isSandbox" fill="outline" size="small" @click="cloneGroup()">
              <ion-icon slot="start" :icon="copyOutline" />
              {{ translate("Clone") }}
            </ion-button>
          </div>
        </div>
        <div>
          <ion-item>
            <ion-label>{{ translate("Created at") }}</ion-label>
            <ion-label slot="end">{{ commonUtil.getDateAndTime(group.createdDate) }}</ion-label>
          </ion-item>
          <ion-item>
            <ion-label>{{ translate("Updated at") }}</ion-label>
            <ion-label slot="end">{{ commonUtil.getDateAndTime(group.lastUpdatedStamp) }}</ion-label>
          </ion-item>
          <ion-item v-if="!isSandbox" lines="none">
            <ion-icon slot="start" :icon="pulseOutline" />
            <ion-select :label="translate('Status')" interface="popover" :interface-options="{ subHeader: translate('Status') }" :value="job.paused || 'Y'" @ionChange="updateGroupStatus($event)">
              <ion-select-option value="N">{{ translate("Active") }}</ion-select-option>
              <ion-select-option value="Y">{{ translate("Draft") }}</ion-select-option>
            </ion-select>
          </ion-item>
        </div>
      </ion-card>

      <ion-card v-if="!isSandbox">
        <ion-card-header>
          <div class="header">
            <div>
              <ion-card-subtitle>{{ translate("Scheduler") }}</ion-card-subtitle>
              <ion-card-title>{{ getCronString() || translate("No schedule") }}</ion-card-title>
            </div>
            <ion-button fill="outline" size="small" color="medium" @click="openScheduleModal()">
              <ion-icon slot="start" :icon="timerOutline" />
              {{ job?.cronExpression ? translate("Edit schedule") : translate("Add schedule") }}
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

      <ion-card v-if="!isSandbox && !userStore.hasPermission('ROUTING_TEST_DRIVE_VIEW')">
        <ion-card-header>
          <ion-card-subtitle>{{ translate("Test drive") }}</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          {{ translate("Test drive your routing group to see how specific orders are routed. Try different kind of orders to quickly verify if all flows are working as expected.") }}
        </ion-card-content>
        <ion-item lines="none">
          <ion-button fill="outline" expand="block" :disabled="hasUnsavedChanges" @click="router.push(`/order-routing/${group.routingGroupId}/test`)">
            <ion-icon slot="start" :icon="speedometerOutline" />
            {{ translate("Test drive") }}
          </ion-button>
        </ion-item>
      </ion-card>

      <ion-list-header>
        <ion-label>{{ translate("Routings") }}</ion-label>
        <ion-button v-if="!isSandbox" fill="clear" color="primary" @click="createNewRouting()">
          <ion-icon slot="start" :icon="addCircleOutline" />
          {{ translate("New") }}
        </ion-button>
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
            <ion-badge slot="end" color="primary" v-if="activeRoutingId === routing.orderRoutingId">{{ translate("Selected") }}</ion-badge>
          </ion-item>
        </ion-card>
      </ion-reorder-group>
      <ion-item v-if="getArchivedOrderRoutings().length > 0" @click="openArchivedRoutingModal()" button lines="full">
          <ion-label>{{ translate("Archived") }}</ion-label>
          <ion-badge color="medium">{{ getArchivedOrderRoutings().length }} {{ translate(getArchivedOrderRoutings().length > 1 ? "routings" : "routing") }}</ion-badge>
        </ion-item>
      </ion-list>
      <div v-else class="empty-state">
        <p>{{ translate("Create routings for this Routing group to execute.") }}</p>
        <ion-button v-if="!isSandbox" @click="createNewRouting()" fill="outline">
          <ion-icon :icon="addOutline" slot="start" />
          {{ translate("Create routing") }}
        </ion-button>
      </div>
    </div>

    <!-- Routing Column -->
    <div class="routing" v-if="activeRouting?.orderRoutingId">
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
          <ion-button v-if="!isSandbox" size="small" color="medium" fill="outline" @click="cloneRouting(activeRouting)">
            <ion-icon slot="start" :icon="copyOutline" />
            <ion-label>{{ translate("Clone") }}</ion-label>
          </ion-button>
        </div>
        <ion-item v-if="!isSandbox" class="history" button @click="openRoutingHistoryModal(activeRoutingId, activeRouting?.routingName)">
          <ion-icon :icon="timeOutline" slot="start"></ion-icon>
          <ion-label>{{ translate("Last run") }}</ion-label>
          <ion-chip slot="end">
            <ion-label>{{ routingHistory[activeRoutingId] ? commonUtil.getDateAndTimeShort(routingHistory[activeRoutingId][0].startDate) : "-" }}</ion-label>
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
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY')">
              <ion-select multiple :placeholder="translate('product category')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'PROD_CATEGORY', true)">
                <div slot="label">
                  {{ translate("Product Category") }}
                </div>
                <ion-select-option v-for="(category, productCategoryId) in catalogCategories" :key="productCategoryId" :value="productCategoryId">{{ category.categoryName || productCategoryId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY_EXCLUDED')">
              <ion-select multiple :placeholder="translate('product category')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'PROD_CATEGORY_EXCLUDED', true)">
                <div slot="label">
                  <ion-label>{{ translate("Product Category") }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(category, productCategoryId) in catalogCategories" :key="productCategoryId" :value="productCategoryId">{{ category.categoryName || productCategoryId }}</ion-select-option>
              </ion-select>
            </ion-item>
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
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROMISE_DATE')">
              <ion-label>{{ translate("Promise date") }}</ion-label>
              <ion-chip outline @click="selectPromiseFilterValue($event)">
                {{ getPromiseDateValue() }}
              </ion-chip>
            </ion-item>
            <ion-item v-if="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROMISE_DATE_EXCLUDED')">
              <ion-label>{{ translate("Promise date") }}</ion-label>
              <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
              <ion-chip outline @click="selectPromiseFilterValue($event, 'excluded')">
                {{ getPromiseDateValue() }}
              </ion-chip>
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
            {{ translate("Add routing rule") }}
            <ion-icon :icon="addCircleOutline" slot="end"/>
          </ion-button>
        </section>
      </div>
    </div>

    <!-- Routing Rules Column -->
    <div class="routing-rule" v-if="activeRouting?.orderRoutingId">
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
              {{ translate("All facilities enabled for online fulfillment will be attempted for routing if no filter is applied.") }}<br /><br />
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
              <ion-label>{{ translate("Safety stock") }}</ion-label>
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
            <ion-item v-if="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'WOS')">
              <ion-label>{{ translate('Week of Supply') }}</ion-label>
              <ion-chip slot="end" outline @click="selectValue('WOS', 'Add week of supply')">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "WOS").fieldValue || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "WOS").fieldValue == 0 ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "WOS").fieldValue : "-" }}</ion-chip>
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
              {{ translate("Select if partial allocation should be allowed in this routing rule") }}
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
    <!-- Live mode persists via this FAB; in sandbox the Variations rail owns saving the variation. -->
    <ion-fab v-if="!isSandbox" vertical="bottom" horizontal="end" slot="fixed">
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
        <h2>{{ translate("No routing selected") }}</h2>
        <p class="description">{{ translate("Select a routing from the list to view its details and manage routing rules.") }}</p>

        <div class="action-prompt">
          <ion-icon :icon="sparklesOutline" />
          <p>{{ translate("Ask the assistant to help you create or modify rules") }}</p>
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
  IonInput,
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
  IonFab,
  IonFabButton,
  IonSpinner,
  modalController,
  popoverController,
  alertController
} from '@ionic/vue';
import { 
  filterOutline, 
  swapVerticalOutline,
  bookmarkOutline,
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
  flashOutline,
  reorderTwoOutline,
  archiveOutline,
  addOutline,
  listOutline,
  speedometerOutline
} from 'ionicons/icons';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useCircuitStore } from '@/store/circuit';
import { orderRoutingStore } from '@/store/orderRoutingStore';
import { productStore } from '@/store/productStore';
import { useUserStore } from '@/store/userStore';
import { useUtilStore } from '@/store/utilStore';
import { simulationStore, registerWorkingFlushHook } from '@/store/simulationStore';
import { translate, emitter, logger, commonUtil } from '@common';
import AddOrderRouteFilterOptions from "@/components/AddOrderRouteFilterOptions.vue"
import PromiseFilterPopover from "@/components/PromiseFilterPopover.vue"
import router from "@/router";
import { Rule } from "@/types";
import AddInventoryFilterOptionsModal from "@/components/AddInventoryFilterOptionsModal.vue";
import cronstrue from "cronstrue"
import { DateTime } from "luxon";
import ScheduleModal from "@/components/ScheduleModal.vue";
import GroupHistoryModal from "@/components/GroupHistoryModal.vue"
import RoutingHistoryModal from "@/components/RoutingHistoryModal.vue"
import ArchivedRoutingModal from "@/components/ArchivedRoutingModal.vue"
import ArchivedRuleModal from "@/components/ArchivedRuleModal.vue"
import { DraftAssistantService } from "@/services/DraftAssistantService";
import type { DraftConversationMessage, DraftProposal } from "@/types/draft";
import { buildRoutingRulesBindings, buildRoutingRulesManifest } from "@/utils/routingRulesManifest";
import { buildRoutingAgentSnapshot } from "@/composables/useRoutingAgentSnapshot";
import { useCreateRouting } from "@/composables/useCreateRouting";

const props = defineProps({
  routingGroupId: {
    type: String,
    required: false
  },
  // Sandbox mode: edit the in-memory simulation working copy (simulationStore.working) with
  // NO backend writes, instead of the live routing group. Set true when editing a variation
  // (or on the Simulation page). All live-persistence sites are guarded on !isSandbox.
  sandbox: {
    type: Boolean,
    default: false
  }
})

const circuitStore = useCircuitStore();
const routingStore = orderRoutingStore();
const product = productStore();
const userStore = useUserStore();
const utilStore = useUtilStore();
const sim = simulationStore();

// Single source of truth for "should edits stay in the in-memory working copy instead of
// persisting to the live backend". Every backend-write site is guarded on !isSandbox.value.
const isSandbox = computed(() => props.sandbox);

const routingGroupId = computed(() => props.routingGroupId || null);
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
const isRouteNameUpdating = ref(false)
const routeName = ref("")
const routeNameRef = ref()
const inventoryRuleActions = ref({}) as any;
const ruleActionType = ref("");
const rulesInformation = ref({}) as any;
const initialRulesInformation = ref({}) as any;
// Sandbox only: monotonic counter backing the client _tempId of rules/routings added to a
// variation working copy (persisted entities use their backend id; new ones need a stable key).
let tempIdCounter = 0;
const actionEnums = JSON.parse(import.meta.env.VITE_RULE_ACTION_ENUMS as string || '{}');
const conditionFilterEnums = JSON.parse(import.meta.env.VITE_RULE_FILTER_ENUMS as string || '{}');
const conditionSortEnums = JSON.parse(import.meta.env.VITE_RULE_SORT_ENUMS as string || '{}');

const groupName = ref("");
const isGroupNameUpdating = ref(false);
const groupNameRef = ref();
const description = ref("");
const isDescUpdating = ref(false);
const descRef = ref();
const isLoadingGroup = ref(false);
const isReordering = ref(false);
const job = ref({}) as any;
const groupHistory = ref([]) as any;

const ruleEnums = JSON.parse(import.meta.env.VITE_RULE_ENUMS as string || '{}');

const facilities = computed(() => product.getVirtualFacilities);
const enums = computed(() => utilStore.getEnums);
const shippingMethods = computed(() => product.getShippingMethods);
const facilityGroups = computed(() => product.getFacilityGroups);
const brokeringFacilityGroups = computed(() => product.getFacilityGroups); // Assuming brokering uses same for now or similar
const routingHistory = computed(() => routingStore.getRoutingHistory)
const userProfile = computed(() => userStore.getUserProfile)

const operatorRef = ref()
const measurementRef = ref()

const currentRoutingGroup: any = computed(() => routingStore.getCurrentRoutingGroup)

const getStatusDesc = computed(() => (id: string) => utilStore.getStatusDesc(id))
const routingStatus = computed(() => activeRouting.value?.statusId)
const selectedRoutingRule = computed(() => activeRule.value || {})
const getRuleStatus = computed(() => (ruleId: string) => rulesForReorder.value.find((rule: Rule) => rule.routingRuleId == ruleId)?.statusId)

function isInventoryRuleFiltersApplied() {
  const ruleFilters = Object.keys(inventoryRuleFilterOptions.value).filter((rule: string) => rule !== conditionFilterEnums["SPLIT_ITEM_GROUP"]?.code);
  return ruleFilters.length
}

type CircuitDraftProposal = DraftProposal & {
  id: string;
  sourcePrompt: string;
  createdAt: number;
};

async function prepareDraftProposal(prompt: string, conversationHistory: DraftConversationMessage[] = []) {
  if (!activeRouting.value?.orderRoutingId) {
    return {
      proposal: null,
      message: translate("Select a routing before drafting changes.")
    };
  }

  const manifest = await buildCircuitDraftManifest();
  circuitStore.setLastPrompt({
    prompt,
    conversationHistory,
    pageCapabilityManifest: manifest,
    outputContract: manifest.outputContract
  });
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

async function applyDraftProposal(proposal: CircuitDraftProposal) {
  if (!activeRouting.value?.orderRoutingId) {
    return {
      appliedCount: 0,
      message: translate("Select a routing before drafting changes.")
    };
  }

  const manifest = await buildCircuitDraftManifest();

  const result = await DraftAssistantService.applyDraftProposal(proposal, manifest, {
    createSiblingRouting: async (name: string) => {
      // Sandbox: a variation can't spawn a new live routing; signal "not created" so the draft
      // apply skips the sibling and only applies rule/filter/action edits to the working copy.
      if (isSandbox.value) return "";
      const existing = group.value?.routings || [];
      const tail = existing[existing.length - 1];
      const sequenceNum = tail?.sequenceNum >= 0 ? tail.sequenceNum + 5 : 0;
      const newId = await routingStore.createOrderRouting({
        orderRoutingId: "",
        routingGroupId: routingGroupId.value || "",
        statusId: "ROUTING_DRAFT",
        routingName: name,
        sequenceNum,
        description: "",
        createdDate: DateTime.now().toMillis()
      });
      return newId || "";
    },
    selectRouting: (id: string) => {
      // Sandbox: resolve against the working copy, not live routingStore.currentGroup.
      group.value = isSandbox.value ? sim.working : routingStore.currentGroup;
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
  return buildRoutingRulesBindings({
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
  return buildRoutingRulesManifest({
    pageRoute: "/circuit",
    orderRoutingId: activeRouting.value?.orderRoutingId || "",
    routingName: routeName.value,
    routingStatus: activeRouting.value?.statusId || "",
    brokeringRun: {
      routingGroupId: group.value.routingGroupId || routingGroupId.value || "",
      groupName: groupName.value || group.value.groupName || "",
      productStoreId: group.value.productStoreId || "",
      schedule: job.value || null,
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
    ...buildRoutingAgentSnapshot()
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
  prepareDraftProposal,
  applyDraftProposal
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

function getPromiseDateValue() {
  const promiseDateFilter = getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE") || getFilterValue(orderRoutingFilterOptions.value, ruleEnums, "PROMISE_DATE_EXCLUDED")
  return promiseDateFilter?.fieldValue || '-'
}

// Product categories for the PROD_CATEGORY(/_EXCLUDED) order filter select.
const catalogCategories = computed((): any => utilStore.getCatalogCategories)

// Promise-date filter uses a duration popover (past durations stored as a negative value).
async function selectPromiseFilterValue(ev: CustomEvent, type = "included") {
  const key = type === "excluded" ? "PROMISE_DATE_EXCLUDED" : "PROMISE_DATE"
  const popover = await popoverController.create({
    component: PromiseFilterPopover,
    componentProps: {
      value: getFilterValue(orderRoutingFilterOptions.value, ruleEnums, key).fieldValue
    },
    event: ev,
    translucent: true,
    showBackdrop: true
  })

  popover.onDidDismiss().then((result: any) => {
    if (result.data?.duration || result.data?.duration == 0) {
      getFilterValue(orderRoutingFilterOptions.value, ruleEnums, key).fieldValue = result.data?.isPastDuration ? `-${result.data?.duration}` : result.data?.duration
      // Applying a promise-date filter forces partial allocation to MULTI.
      updatePartialAllocation(true)
      hasUnsavedChanges.value = true
    }
    getFilterValue(orderRoutingFilterOptions.value, ruleEnums, key).operator = "less-equals"
  })

  return popover.present()
}

const isRuleNameUpdating = ref(false)
const hasUnsavedChanges = ref(false)
const ruleNameRef = ref()

onMounted(async () => {
  window.addEventListener('pointerup', resetReordering);
  window.addEventListener('touchend', resetReordering);
  window.addEventListener('mouseup', resetReordering);
  // In sandbox mode, register the working-flush hook so variation saves (from the rail) capture
  // this editor's pending edits, and bind to the in-memory working copy instead of fetching.
  registerWorkingFlushHook(flushWorking);
  if (isSandbox.value) {
    await initializeFromWorking();
  } else {
    await fetchRoutingGroupInformation();
  }
});

onUnmounted(() => {
  window.removeEventListener('pointerup', resetReordering);
  window.removeEventListener('touchend', resetReordering);
  window.removeEventListener('mouseup', resetReordering);
  registerWorkingFlushHook(null);
});

function resetReordering() {
  isReordering.value = false;
}

// Live: re-load from backend when the routing group id changes.
watch(routingGroupId, async () => {
  if (!isSandbox.value) await fetchRoutingGroupInformation();
});

// Sandbox: re-bind when the store swaps the working copy (load variation / reset to baseline).
watch(() => sim.working, async () => {
  if (isSandbox.value) await initializeFromWorking();
});

async function fetchRoutingGroupInformation() {
  if (!routingGroupId.value || "") {
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

  // Local loading state (not the global App.vue singleton loader): this fetch runs on mount
  // and can overlap other flows on the detail page (e.g. the simulation store loading), and the
  // shared singleton loader can't safely handle concurrent callers. A local spinner is isolated.
  isLoadingGroup.value = true
  try {
    await routingStore.fetchCurrentRoutingGroup(routingGroupId.value || "");
    if(Object.keys(currentRoutingGroup.value).length) {
      group.value = currentRoutingGroup.value
      groupName.value = group.value.groupName || ""
      description.value = group.value.description || ""

      await Promise.all([
        fetchGroupHistory(),
        fetchGroupSchedule(),
        product.fetchRoutingReferenceData({ productStoreId: group.value.productStoreId }),
        utilStore.fetchStatusInformation()
      ])
      // Categories back the PROD_CATEGORY(/_EXCLUDED) filter select options; they aren't
      // needed for initial paint, so load them without blocking the group load.
      utilStore.fetchCategories()

      if(group.value.routings?.length) {
        selectRouting(group.value.routings[0]);
      }
    }
  } catch(err) {
    logger.error(err);
  }
  isLoadingGroup.value = false
}

async function fetchRoutingsInformation() {
  // Details are now fetched as part of fetchCurrentRoutingGroup (raw data)
  return;
}

const { promptCreateRouting } = useCreateRouting();
function createNewRouting() {
  if (isSandbox.value) return; // adding a routing to a variation isn't supported (matches the sim flow)
  if (!routingGroupId.value) return;
  return promptCreateRouting({
    routingGroupId: routingGroupId.value,
    existingRoutings: group.value?.routings || [],
    onCreated: (newRoutingId) => {
      group.value = currentRoutingGroup.value;
      hasUnsavedChanges.value = true;
      const created = group.value.routings?.find((r: any) => r.orderRoutingId === newRoutingId);
      if (created) selectRouting(created);
    }
  });
}

const selectRouting = (routing: any) => {
  // Sandbox: flush edits of the routing we're leaving back into the working copy before switching,
  // so edits across multiple routings all persist into the variation snapshot (not just the last).
  if (isSandbox.value) {
    syncActiveRuleDraft();
    syncWorkingFromLocalState();
  }
  activeRoutingId.value = routing.orderRoutingId;
  activeRouting.value = routing;
  initialActiveRouting.value = JSON.parse(JSON.stringify(routing));
  activeRuleId.value = '';
  activeRule.value = null;
  rulesInformation.value = {};
  initialRulesInformation.value = {};

  // Live only: sync store-side currentRoutingId so getCurrentRule / fetchInventoryRuleInformation
  // resolve correctly. In sandbox the working copy is not in routingStore.currentGroup, so this
  // would both leak into live state and be pointless.
  if (!isSandbox.value) routingStore.setCurrentOrderRouting(routing.orderRoutingId);

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
  // Sandbox: read the rule straight from the in-memory working copy — no backend fetch. Flush the
  // previously-open rule first (keyed by ruleKey so client-added _tempId rules are handled).
  if (isSandbox.value) {
    syncActiveRuleDraft();
    const key = ruleKey(rule);
    activeRuleId.value = key;
    if (!rulesInformation.value[key]) {
      rulesInformation.value[key] = JSON.parse(JSON.stringify(rule));
      initialRulesInformation.value[key] = JSON.parse(JSON.stringify(rule));
    }
    activeRule.value = rulesInformation.value[key];
    initializeInventoryRule(activeRule.value);
    return;
  }

  activeRuleId.value = rule.routingRuleId;

  // Fetch full rule information including actions and filters
  try {
    if(!rulesInformation.value[rule.routingRuleId]) {
      const formatted = await routingStore.fetchInventoryRuleInformation(rule.routingRuleId)
      // fetchInventoryRuleInformation returns {} if the store can't resolve the rule
      // (e.g. currentRoutingId mismatch). Fall back to the raw rule object so the
      // detail panel still renders something usable.
      rulesInformation.value[rule.routingRuleId] = (formatted && formatted.routingRuleId) ? formatted : rule
      initialRulesInformation.value[rule.routingRuleId] = JSON.parse(JSON.stringify(rulesInformation.value[rule.routingRuleId] || {}))
    }
    activeRule.value = rulesInformation.value[rule.routingRuleId] || rule
  } catch (err) {
    logger.error(err);
    activeRule.value = rule;
  }
  initializeInventoryRule(activeRule.value);
};

// --- Sandbox (variation working-copy) helpers, ported from SimulationCanvas ---
// A rule's stable key: persisted rules have routingRuleId; rules added in-sandbox have only
// a client _tempId (so the diff/save treats them as new).
function ruleKey(rule: any) {
  return rule?.routingRuleId || rule?._tempId || "";
}
// The variation working copy stores a rule's conditions/actions as FLAT ARRAYS; the editor
// controls consume keyed-by-code maps. These adapt flat -> keyed.
function buildOptionMap(conditions: any[] | undefined, conditionTypeEnumId: string) {
  return (conditions || [])
    .filter((c: any) => c.conditionTypeEnumId === conditionTypeEnumId)
    .reduce((map: any, c: any) => { map[c.fieldName] = { ...c }; return map; }, {});
}
function buildActionMap(actions: any[] | undefined) {
  return (actions || []).reduce((map: any, a: any) => {
    const id = a.routingActionTypeId || a.actionTypeEnumId;
    if (id) map[id] = { ...a, routingActionTypeId: id };
    return map;
  }, {});
}
// Flush the active routing's order filters + rules array back into the working copy (which is
// group.value === sim.working by reference, so this mutates the store's copy in place).
function syncWorkingFromLocalState() {
  if (!activeRouting.value) return
  activeRouting.value.orderFilters = [
    ...Object.values(orderRoutingFilterOptions.value || {}),
    ...Object.values(orderRoutingSortOptions.value || {})
  ].map((c: any) => ({ ...c }))
  activeRouting.value.rules = JSON.parse(JSON.stringify(inventoryRules.value))
}
// Commit all pending local editor state into the working copy. Registered as the store's
// working-flush hook (see onMounted) so variation saves from the Variations sheet capture edits.
// No-op in live mode (live persistence goes through save()/per-action writes, not the flush).
function flushWorking() {
  if (!isSandbox.value) return
  syncActiveRuleDraft()
  syncWorkingFromLocalState()
}

// Sandbox load: bind the editor to the in-memory simulation working copy (no backend fetch).
// group.value is pointed AT sim.working by reference so edits propagate into the store copy.
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
  group.value = sim.working;
  groupName.value = group.value.groupName || "";
  description.value = group.value.description || "";
  try {
    await Promise.all([
      product.fetchRoutingReferenceData({ productStoreId: group.value.productStoreId }),
      utilStore.fetchStatusInformation()
    ]);
    utilStore.fetchCategories();
  } catch (err) {
    logger.error(err);
  }
  if (group.value.routings?.length) {
    selectRouting(group.value.routings[0]);
  }
}

function initializeInventoryRule(rule: any) {
  const inventoryFilters = rule["inventoryFilters"]

  // Dual-shape: working-copy rules store a FLAT ARRAY of conditions; live rules store the
  // keyed { ENTCT_FILTER, ENTCT_SORT_BY } structure.
  if (Array.isArray(inventoryFilters)) {
    inventoryRuleFilterOptions.value = buildOptionMap(inventoryFilters, "ENTCT_FILTER")
    inventoryRuleSortOptions.value = buildOptionMap(inventoryFilters, "ENTCT_SORT_BY")
  } else {
    const filters = inventoryFilters || {}
    inventoryRuleFilterOptions.value = filters["ENTCT_FILTER"] ? filters["ENTCT_FILTER"] : {}
    inventoryRuleSortOptions.value = filters["ENTCT_SORT_BY"] ? filters["ENTCT_SORT_BY"] : {}
  }

  inventoryRuleActions.value = Array.isArray(rule["actions"]) ? buildActionMap(rule["actions"]) : (rule["actions"] || {})

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

async function fetchGroupSchedule() {
  try {
    await routingStore.fetchCurrentGroupSchedule({ routingGroupId: routingGroupId.value || "", currentGroup: group.value });
    if (group.value.schedule) {
      job.value = group.value.schedule
    }
  } catch (err) {
    logger.error(err);
  }
}

async function fetchGroupHistory() {
  groupHistory.value = []
  if (!group.value?.jobName) return;

  try {
    const resp = await routingStore.fetchGroupHistory(group.value.jobName, { orderByField: "startTime DESC" })
    if (!commonUtil.hasError(resp)) {
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
  if (groupName.value.trim() && groupName.value.trim() !== group.value.groupName.trim()) {
    const resultId = await updateRoutingGroup({ routingGroupId: routingGroupId.value || "", productStoreId: group.value.productStoreId, groupName: groupName.value })
    if (resultId) {
      group.value.groupName = groupName.value
    } else {
      groupName.value = group.value.groupName.trim()
    }
  }
  isGroupNameUpdating.value = false
}

async function editGroupDescription() {
  isDescUpdating.value = !isDescUpdating.value
  await nextTick()
  descRef.value?.$el?.setFocus()
}

async function updateGroupDescription() {
  const next = (description.value || "").trim()
  const current = (group.value.description || "").trim()
  // Only persist when the value actually changed (avoids a needless write when opening/closing the editor).
  if (next !== current) {
    const resultId = await updateRoutingGroup({ routingGroupId: routingGroupId.value || "", productStoreId: group.value.productStoreId, description: next })
    if (resultId) {
      group.value.description = next
    } else {
      description.value = current
    }
  }
  isDescUpdating.value = false
}

async function updateRoutingGroup(payload: any) {
  if (isSandbox.value) {
    // Sandbox: mutate the in-memory working copy (group.value === sim.working); no backend write.
    if (payload.groupName !== undefined) group.value.groupName = payload.groupName
    if (payload.description !== undefined) group.value.description = payload.description
    hasUnsavedChanges.value = true
    return payload.routingGroupId || group.value.routingGroupId || "sandbox"
  }
  emitter.emit("presentLoader", { message: translate("Updating..."), backdropDismiss: false })
  let rGId = ''
  try {
    const resp = await routingStore.updateRoutingGroup(payload);
    if(resp) {
      commonUtil.showToast(translate("Routing group information updated"))
      rGId = payload.routingGroupId
    }
  } catch (err) {
    commonUtil.showToast(translate("Failed to update group information"))
    logger.error(err);
  }
  emitter.emit("dismissLoader")
  return rGId
}

async function cloneGroup() {
  if (isSandbox.value) return // group-level live action; not applicable to a sandboxed variation
  const payload = {
    routingGroupId: group.value.routingGroupId,
    newGroupName: `${group.value.groupName} copy`
  }
  try {
    const resp = await routingStore.cloneGroup(payload)
    if (!commonUtil.hasError(resp)) {
      commonUtil.showToast(translate("Routing group cloned"))
    }
  } catch (err) {
    commonUtil.showToast(translate("Failed to clone routing group"))
    logger.error(err)
  }
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
  if (isSandbox.value) return // scheduling is a live group action; not applicable to a variation
  if (!job.value.cronExpression) {
    commonUtil.showToast(translate("Please select a scheduling for job"))
    return;
  }

  const payload = {
    routingGroupId: routingGroupId.value || "",
    paused: job.value.paused || 'N',
    ...job.value
  }

  try {
    const resp = await routingStore.scheduleBrokering(payload)
    if (!commonUtil.hasError(resp)) {
      commonUtil.showToast(translate("Job updated"))
      await fetchGroupSchedule()
    }
  } catch (err) {
    commonUtil.showToast(translate("Failed to update job"))
    logger.error(err)
  }
}

async function updateGroupStatus(event: CustomEvent) {
  if (isSandbox.value) return // live group status; not applicable to a variation
  job.value.paused = event.detail.value

  const payload = {
    routingGroupId: routingGroupId.value || "",
    paused: job.value.paused,
    cronExpression: job.value.cronExpression || "0 0 0 * * ?"
  }

  try {
    const resp = await routingStore.scheduleBrokering(payload)
    if (!commonUtil.hasError(resp)) {
      job.value.cronExpression = job.value.cronExpression || "0 0 0 * * ?"
      commonUtil.showToast(translate("Group status updated"))
    }
  } catch (err) {
    commonUtil.showToast(translate("Failed to update group status"))
    logger.error(err)
  }
}

async function runNow() {
  if (isSandbox.value) return // live run; variations are run via the Variations rail
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
              const resp = await routingStore.scheduleBrokering(payload)
              if (!commonUtil.hasError(resp)) job.value.jobName = resp.data.jobName
            } catch (err) {
              logger.error(err)
              return;
            }
          }

          try {
            const resp = await routingStore.runNow(routingGroupId.value || "")
            if (!commonUtil.hasError(resp)) commonUtil.showToast(translate("Service has been scheduled"))
          } catch (err) {
            commonUtil.showToast(translate("Failed to schedule service"))
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
  inventoryRules.value.forEach((inventoryRule: any) => {
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
  if (activeRule.value.ruleName.trim() && !isSandbox.value) {
    emitter.emit("presentLoader", { message: translate("Updating..."), backdropDismiss: false })

    let ruleId = await routingStore.updateRule({
      routingRuleId,
      ruleName: activeRule.value.ruleName
    })

    if (ruleId) {
      commonUtil.showToast(translate("Routing rule information updated"))
    }
    emitter.emit("dismissLoader")
  } else if (isSandbox.value) {
    // Sandbox: the rename already mutated activeRule.value.ruleName via v-model; just mark dirty.
    hasUnsavedChanges.value = true
  }
  isRuleNameUpdating.value = false
}

async function cloneRule(rule: any) {
  if (isSandbox.value) return // clone-rule is a live action; not supported for a sandboxed variation
  emitter.emit("presentLoader", { message: translate("Cloning rule"), backdropDismiss: false })
  const resp = await routingStore.cloneRule({
    routingRuleId: rule.routingRuleId,
    ruleName: rule.ruleName,
    orderRoutingId: activeRouting.value.orderRoutingId
  })
  if(!commonUtil.hasError(resp)) {
    // If needed, refresh routing information
    commonUtil.showToast(translate("Rule cloned successfully"))
  }
  emitter.emit("dismissLoader")
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
    header: translate("New Routing Rule"),
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
      const sequenceNum = inventoryRules.value.length && inventoryRules.value[inventoryRules.value.length - 1].sequenceNum >= 0 ? inventoryRules.value[inventoryRules.value.length - 1].sequenceNum + 5 : 0

      // Sandbox: keep the added rule in-memory only. It must NOT get a routingRuleId so the
      // variation diff treats it as an ADD_RULE; a client _tempId gives it a stable :key.
      // Conditions/actions use the flat-array working-copy shape.
      if (isSandbox.value) {
        const newRule = {
          _tempId: `temp-rule-${++tempIdCounter}`,
          orderRoutingId: activeRouting.value.orderRoutingId,
          ruleName,
          statusId: "RULE_DRAFT",
          sequenceNum,
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
        return
      }

      const payload = {
        routingRuleId: "",
        orderRoutingId: activeRouting.value.orderRoutingId,
        ruleName,
        statusId: "RULE_DRAFT",
        sequenceNum,
        assignmentEnumId: "ORA_SINGLE",
        createdDate: DateTime.now().toMillis()
      }

      const routingRuleId = await routingStore.createRoutingRule(payload)
      if(routingRuleId) {
        await routingStore.updateRule({
          routingRuleId,
          orderRoutingId: activeRouting.value.orderRoutingId,
          actions: [{
            actionTypeEnumId: "ORA_NEXT_RULE",
            actionValue: "",
            createdDate: DateTime.now().toMillis()
          }]
        })
        await routingStore.fetchCurrentOrderRouting(activeRouting.value.orderRoutingId)
        inventoryRules.value = commonUtil.sortSequence(JSON.parse(JSON.stringify(activeRouting.value["rules"])))
        initializeInventoryRules()
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

  archivedRuleModal.onDidDismiss().then(() => {
    // Sandbox: re-bind from the in-memory working copy instead of hitting the backend.
    if (isSandbox.value) initializeFromWorking();
    else fetchRoutingGroupInformation();
  })

  await archivedRuleModal.present();
}


async function save() {
  // Sandbox: never persist to the live backend. Edits are captured into the variation working
  // copy via the flush hook; the Variations rail owns saving a variation. Flush and stop.
  if (isSandbox.value) {
    flushWorking()
    return
  }
  emitter.emit("presentLoader", { message: "Updating routing rules and filters", backdropDismiss: false })
  syncActiveRuleDraft()
  const localRulesPersisted = await persistLocalInventoryRules()
  if(!localRulesPersisted) {
    emitter.emit("dismissLoader")
    return
  }

  const orderRouting = {
    orderRoutingId: activeRouting.value.orderRoutingId,
    routingGroupId: group.value.routingGroupId
  } as any;

  if(initialActiveRouting.value?.statusId !== activeRouting.value.statusId) {
    orderRouting.statusId = activeRouting.value.statusId;
  }

  if(activeRouting.value["rules"]) {
    let diffSeq = findRulesDiff(activeRouting.value["rules"], inventoryRules.value);
    diffSeq = Object.keys(diffSeq).map((key) => diffSeq[key]);

    if(diffSeq.length) {
      orderRouting.rules = diffSeq;
    }
  }
  
  // Save routing-level changes first
  const initialOrderFilters = activeRouting.value["orderFilters"]?.length ? activeRouting.value["orderFilters"].reduce((filters: any, filter: any) => {
    if(filters[filter.conditionTypeEnumId]) {
      filters[filter.conditionTypeEnumId][filter.fieldName] = filter
    } else {
      filters[filter.conditionTypeEnumId] = {
        [filter.fieldName]: filter
      }
    }
    return filters
  }, {}) : {}

  const routeSortOptionsDiff = findSortDiff(initialOrderFilters["ENTCT_SORT_BY"] ? initialOrderFilters["ENTCT_SORT_BY"] : {}, orderRoutingSortOptions.value)
  const routeFilterOptionsDiff = findFilterDiff(initialOrderFilters["ENTCT_FILTER"] ? initialOrderFilters["ENTCT_FILTER"] : {}, orderRoutingFilterOptions.value)

  // As we have explicitely added the options for exclude filter for routing rules, we will remove the _excluded from the fieldName parameter before updating the same
  Object.entries(routeFilterOptionsDiff.seqToRemove).map(([key, value]: any) => {
    if(key.includes("_excluded")) {
      value["fieldName"] = value["fieldName"].split("_")[0]
    }
  })

  Object.entries(routeFilterOptionsDiff.seqToUpdate).map(([key, value]: any) => {
    if(key.includes("_excluded")) {
      value["fieldName"] = value["fieldName"].split("_")[0]
    }
  })

  const filtersToRemove = Object.values({ ...routeFilterOptionsDiff.seqToRemove, ...routeSortOptionsDiff.seqToRemove })
  const filtersToUpdate = Object.values({ ...routeFilterOptionsDiff.seqToUpdate, ...routeSortOptionsDiff.seqToUpdate })

  if(filtersToRemove?.length) {
    await routingStore.deleteRoutingFilters({ filters: filtersToRemove, orderRoutingId: activeRouting.value.orderRoutingId })
  }

  if(filtersToUpdate?.length || orderRouting.rules?.length || orderRouting.statusId) {
    orderRouting["orderFilters"] = filtersToUpdate
    const orderRoutingId = await routingStore.updateRouting(orderRouting)
    if(orderRoutingId) {
      activeRouting.value["orderFilters"] = Object.values({ ...orderRoutingFilterOptions.value, ...orderRoutingSortOptions.value })
      if(orderRouting.rules?.length) {
        activeRouting.value["rules"] = JSON.parse(JSON.stringify(inventoryRules.value))
      }
      initialActiveRouting.value = JSON.parse(JSON.stringify(activeRouting.value))
    }
  }

  const rulesDiff = buildRulesInformationDiff()
  for(const rule of rulesDiff) {
    if(rule.filtersToRemove?.length) {
      await routingStore.deleteRuleConditions({ routingRuleId: rule.routingRuleId, conditions: rule.filtersToRemove })
    }

    if(rule.actionsToRemove?.length) {
      await routingStore.deleteRuleActions({ routingRuleId: rule.routingRuleId, actions: rule.actionsToRemove })
    }

    if(rule.filtersToUpdate?.length || rule.actionsToUpdate?.length) {
      await routingStore.updateRule({
        routingRuleId: rule.routingRuleId,
        orderRoutingId: rule.orderRoutingId,
        inventoryFilters: rule.filtersToUpdate,
        actions: rule.actionsToUpdate
      })
    }
  }

  // Refresh current routing and touched rule information
  await routingStore.fetchCurrentOrderRouting(activeRouting.value.orderRoutingId)
  for(const rule of rulesDiff) {
    rulesInformation.value[rule.routingRuleId] = await routingStore.fetchInventoryRuleInformation(rule.routingRuleId)
    initialRulesInformation.value[rule.routingRuleId] = JSON.parse(JSON.stringify(rulesInformation.value[rule.routingRuleId] || {}))
  }
  initialRulesInformation.value = {
    ...initialRulesInformation.value,
    ...JSON.parse(JSON.stringify(rulesInformation.value))
  }
  if(activeRule.value?.routingRuleId && rulesInformation.value[activeRule.value.routingRuleId]) {
    initializeInventoryRule(rulesInformation.value[activeRule.value.routingRuleId]);
  }
  activeRouting.value["rules"] = JSON.parse(JSON.stringify(inventoryRules.value))
  initialActiveRouting.value = JSON.parse(JSON.stringify(activeRouting.value))
  initializeInventoryRules()

  hasUnsavedChanges.value = false
  emitter.emit("dismissLoader")
  commonUtil.showToast(translate("Changes saved successfully"))
}

function syncActiveRuleDraft() {
  if (isSandbox.value) {
    // Sandbox: serialize the open rule's edits to FLAT ARRAYS (working-copy shape), keyed by
    // ruleKey so client-added (_tempId) rules are handled, and mirror back into inventoryRules.
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
    activeRule.value.inventoryFilters = inventoryFilters
    activeRule.value.actions = actions
    rulesInformation.value[key] = activeRule.value
    const idx = inventoryRules.value.findIndex((r: any) => ruleKey(r) === key)
    if (idx >= 0) {
      inventoryRules.value[idx] = { ...inventoryRules.value[idx], ...activeRule.value, inventoryFilters, actions }
    }
    return
  }

  const ruleId = activeRule.value?.routingRuleId
  if(!ruleId) return

  rulesInformation.value[ruleId] = {
    ...(rulesInformation.value[ruleId] || activeRule.value),
    ...activeRule.value,
    inventoryFilters: {
      ENTCT_FILTER: inventoryRuleFilterOptions.value,
      ENTCT_SORT_BY: inventoryRuleSortOptions.value
    },
    actions: inventoryRuleActions.value
  }
}

async function persistLocalInventoryRules() {
  const localRules = inventoryRules.value.filter((rule: any) => isLocalRuleId(rule.routingRuleId))

  for(const rule of localRules) {
    const localRuleId = rule.routingRuleId
    const payload = {
      ...rule,
      routingRuleId: "",
      orderRoutingId: activeRouting.value.orderRoutingId,
      createdDate: rule.createdDate || DateTime.now().toMillis()
    }
    const persistedRuleId = await routingStore.createRoutingRule(payload)
    if(!persistedRuleId) {
      commonUtil.showToast(translate("Failed to create routing rule"))
      return false
    }

    replaceLocalRuleId(localRuleId, persistedRuleId)
  }

  return true
}

function replaceLocalRuleId(localRuleId: string, persistedRuleId: string) {
  replaceRuleIdInList(inventoryRules.value, localRuleId, persistedRuleId)
  replaceRuleIdInList(rulesForReorder.value, localRuleId, persistedRuleId)

  const ruleInfo = rulesInformation.value[localRuleId] || {}
  delete rulesInformation.value[localRuleId]
  rulesInformation.value[persistedRuleId] = rewriteRuleOwnerIds({
    ...ruleInfo,
    routingRuleId: persistedRuleId
  }, persistedRuleId)

  delete initialRulesInformation.value[localRuleId]
  initialRulesInformation.value[persistedRuleId] = {}

  if(activeRule.value?.routingRuleId === localRuleId) {
    activeRule.value.routingRuleId = persistedRuleId
    activeRuleId.value = persistedRuleId
  }
}

function replaceRuleIdInList(rules: any[], localRuleId: string, persistedRuleId: string) {
  rules.forEach((rule: any) => {
    if(rule.routingRuleId === localRuleId) {
      rule.routingRuleId = persistedRuleId
    }
  })
}

function rewriteRuleOwnerIds(ruleInfo: any, routingRuleId: string) {
  const inventoryFilters = ruleInfo.inventoryFilters || {}
  Object.values(inventoryFilters.ENTCT_FILTER || {}).forEach((filter: any) => filter.routingRuleId = routingRuleId)
  Object.values(inventoryFilters.ENTCT_SORT_BY || {}).forEach((filter: any) => filter.routingRuleId = routingRuleId)
  Object.values(ruleInfo.actions || {}).forEach((action: any) => action.routingRuleId = routingRuleId)
  return ruleInfo
}

function isLocalRuleId(ruleId: string) {
  return String(ruleId || "").startsWith("new:") || String(ruleId || "").startsWith("draft:")
}

function buildRulesInformationDiff() {
  const currentRulesInformation = JSON.parse(JSON.stringify(rulesInformation.value))
  const filterSortDesc = import.meta.env.VITE_FILTER_SORT_DESC as string || ""

  return Object.keys(currentRulesInformation).map((ruleId: string) => {
    const previousRuleInformation = initialRulesInformation.value[ruleId] || {}
    const updatedRuleInformation = currentRulesInformation[ruleId] || {}
    const previousRuleSortOptions = previousRuleInformation["inventoryFilters"]?.["ENTCT_SORT_BY"] || {}
    const updatedRuleSortOptions = updatedRuleInformation["inventoryFilters"]?.["ENTCT_SORT_BY"] || {}
    const sortOptionsDiff = findSortDiff(previousRuleSortOptions, updatedRuleSortOptions)

    Object.values({...sortOptionsDiff.seqToUpdate, ...sortOptionsDiff.seqToRemove}).map((option: any) => {
      if(filterSortDesc.includes(option.fieldName)) {
        option.fieldName += " desc"
      }
    })

    const previousRuleFilterOptions = previousRuleInformation["inventoryFilters"]?.["ENTCT_FILTER"] || {}
    const updatedRuleFilterOptions = updatedRuleInformation["inventoryFilters"]?.["ENTCT_FILTER"] || {}
    const filterOptionsDiff = findFilterDiff(previousRuleFilterOptions, updatedRuleFilterOptions)

    const previousRuleActionOptions = previousRuleInformation["actions"] || {}
    const updatedRuleActionOptions = updatedRuleInformation["actions"] || {}
    const ruleActionsDiff = findActionDiff(previousRuleActionOptions, updatedRuleActionOptions)

    Object.entries(filterOptionsDiff.seqToRemove).map(([key, value]: any) => {
      if(key.includes("_excluded")) {
        value["fieldName"] = value["fieldName"].split("_")[0]
      }
    })

    Object.entries(filterOptionsDiff.seqToUpdate).map(([key, value]: any) => {
      if(key.includes("_excluded")) {
        value["fieldName"] = value["fieldName"].split("_")[0]
      }
    })

    return {
      routingRuleId: ruleId,
      orderRoutingId: activeRouting.value.orderRoutingId,
      filtersToRemove: Object.values({ ...filterOptionsDiff.seqToRemove, ...sortOptionsDiff.seqToRemove }),
      filtersToUpdate: Object.values({ ...filterOptionsDiff.seqToUpdate, ...sortOptionsDiff.seqToUpdate }),
      actionsToRemove: Object.values(ruleActionsDiff.seqToRemove),
      actionsToUpdate: Object.values(ruleActionsDiff.seqToUpdate)
    }
  }).filter((rule: any) => rule.filtersToRemove.length || rule.filtersToUpdate.length || rule.actionsToRemove.length || rule.actionsToUpdate.length)
}

function findRulesDiff(previousSeq: any, updatedSeq: any) {
  const diffSeq: any = Object.keys(previousSeq).reduce((diff, key) => {
    if (updatedSeq[key].routingRuleId === previousSeq[key].routingRuleId
      && updatedSeq[key].statusId === previousSeq[key].statusId
      && updatedSeq[key].assignmentEnumId === previousSeq[key].assignmentEnumId
      && updatedSeq[key].ruleName === previousSeq[key].ruleName
      && updatedSeq[key].sequenceNum === previousSeq[key].sequenceNum) return diff
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

    if (updatedSeq[key].fieldName === previousSeq[key].fieldName && updatedSeq[key].fieldValue == previousSeq[key].fieldValue && updatedSeq[key].operator === previousSeq[key].operator) return diff
    return {
      ...diff,
      [key]: updatedSeq[key]
    }
  }, seqToUpdate)

  seqToUpdate = Object.keys(updatedSeq).reduce((diff, key) => {
    if(!previousSeq[key] && (updatedSeq[key].fieldValue || updatedSeq[key].fieldValue === 0)) {
      diff = {
        ...diff,
        [key]: updatedSeq[key]
      }
    }

    return diff
  }, seqToUpdate)

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
  let seqToUpdate = {} as any
  let seqToRemove = {} as any

  seqToUpdate = Object.keys(previousSeq).reduce((diff, key) => {
    if(!updatedSeq[key]) {
      seqToRemove[key] = previousSeq[key]
      return diff
    }

    if (updatedSeq[key].routingActionTypeId === previousSeq[key].routingActionTypeId && updatedSeq[key].actionValue == previousSeq[key].actionValue) return diff
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

const openRouteDetails = (routing: any) => {
  // Logic to open details modal/menu if needed
  console.log("Open details for:", routing);
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



async function editRouteName() {
  isRouteNameUpdating.value = !isRouteNameUpdating.value;
  await nextTick()
  routeNameRef.value.$el.setFocus();
}

async function updateRouteName() {
  if(routeName.value.trim() && routeName.value.trim() !== activeRouting.value.routingName.trim()) {
    // Sandbox: rename the in-memory routing only; the variation diff persists it on save.
    if (isSandbox.value) {
      activeRouting.value.routingName = routeName.value
      hasUnsavedChanges.value = true
      isRouteNameUpdating.value = false
      return
    }
    emitter.emit("presentLoader", { message: translate("Updating..."), backdropDismiss: false })
    const payload = {
      orderRoutingId: activeRouting.value.orderRoutingId,
      routingName: routeName.value
    }
    try {
      const orderRoutingId = await routingStore.updateRouting(payload);
      if(orderRoutingId) {
        activeRouting.value.routingName = routeName.value
        commonUtil.showToast(translate("Order routing information updated"))
      }
    } catch(err) {
      commonUtil.showToast(translate("Failed to update routing information"))
      logger.error(err);
    }
    emitter.emit("dismissLoader")
  }
  isRouteNameUpdating.value = false
}

async function cloneRouting(routing: any) {
  if (isSandbox.value) return; // cloning a routing into a variation isn't supported (matches the sim flow)
  emitter.emit("presentLoader", { message: translate("Cloning route"), backdropDismiss: false })
  const orderRoutingId = await routingStore.cloneOrderRouting({
    orderRoutingId: routing.orderRoutingId,
    orderRoutingName: routing.routingName,
    routingGroupId: routingGroupId.value || ""
  })
  if(orderRoutingId) {
    await fetchRoutingGroupInformation();
    commonUtil.showToast(translate("Route cloned successfully"))
  }
  emitter.emit("dismissLoader")
}

async function updateRoutingStatus(statusId: string) {
  // Sandbox: flip the status on the in-memory routing only; the variation diff persists it later.
  if (isSandbox.value) {
    if (activeRouting.value) activeRouting.value.statusId = statusId
    hasUnsavedChanges.value = true
    return
  }
  const payload = {
    orderRoutingId: activeRoutingId.value,
    statusId: statusId
  }
  try {
    const orderRoutingId = await routingStore.updateRouting(payload)
    if(orderRoutingId){
      activeRouting.value.statusId = statusId
      commonUtil.showToast(translate("Routing status updated"))
    }
  } catch(err) {
    commonUtil.showToast(translate("Failed to update routing status"))
    logger.error(err)
  }
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

function getInventoryRules(ruleId: string) {
  // In the context of Circuit, we might want to show actions or other related rules
  // For now, let's just return an empty array if not implemented, or use activeRule info
  if (activeRule.value && activeRule.value.routingRuleId === ruleId) {
    // If we have routing rules within the rule, we could return them.
    // Based on BrokeringQuery.vue, inventoryRules are separate.
    // For this UI, we'll just show the active rule as the "Routing Rule" or related data
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
  
  // Update original inventoryRules to maintain state. Match by ruleKey so client-added rules
  // (which have only a _tempId, no routingRuleId) don't all collide on undefined === undefined.
  inventoryRules.value.forEach((rule: any) => {
    const updatedRule = updatedSeq.find((seq: any) => ruleKey(seq) === ruleKey(rule))
    if(updatedRule) {
      rule.sequenceNum = updatedRule.sequenceNum
    }
  })
  hasUnsavedChanges.value = true
  isReordering.value = false
}
async function openRoutingHistoryModal(orderRoutingId: string, routingName: string) {
  // History is a live read that populates shared routingStore.routingHistory (which the live editor
  // binds to); a variation has no run history, so don't touch live state in sandbox mode. The
  // template trigger is also hidden via v-if="!isSandbox"; this is the defense-in-depth guard.
  if (isSandbox.value) return;
  await routingStore.fetchRoutingHistory(routingGroupId.value || "")
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
        if(routings) {
          // Sandbox: re-bind from the working copy instead of hitting the backend.
          if (isSandbox.value) initializeFromWorking()
          else fetchRoutingGroupInformation()
        }
      }
    }
  })

  archivedRoutingModal.present();
}
</script>

<style scoped>

/* The measurement-unit and operator selectors nest an ion-select inside an
   ion-chip. The modern (non-legacy) ion-select applies its own min-height,
   which makes those chips taller than the adjacent value chips and breaks the
   row alignment (most visible in dark mode). Drop the inherited min-height so
   the chip sizes to the select's content, matching BrokeringQuery.vue. */
ion-chip > ion-select {
  min-height: unset;
}

.routing-group-editor {
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

/* Selected routing: a primary ring so the active card is obvious in light and dark mode.
   outline (not box-shadow) keeps the card's default elevation shadow intact. */
.routing.selected-path {
  outline: 2px solid var(--ion-color-primary);
}

/* Routing group description: compact, muted, sits under the title/id. */
.group-description {
  margin: 4px 0 0;
  color: var(--ion-color-medium);
  font-size: 0.85rem;
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
