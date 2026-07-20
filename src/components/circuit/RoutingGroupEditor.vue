<template>
  <RoutingGroupEditorSkeleton v-if="isLoadingGroup || sandboxReferenceLoading" :sandbox="isSandbox" />
  <div v-else-if="sandboxReferenceError" class="empty-state-canvas" role="alert">
    <div class="empty-state-content">
      <div class="empty-content-wrapper">
        <div class="icon-container">
          <ion-icon :icon="gitNetworkOutline" />
        </div>
        <h2>{{ translate("Simulation reference data unavailable") }}</h2>
        <p class="description">{{ simReferences.loadError || translate("Simulation reference data could not be loaded completely.") }}</p>
      </div>
    </div>
  </div>
  <div
    class="routing-group-editor"
    :class="{ 'interaction-locked': interactionLocked }"
    :aria-busy="interactionLocked"
    v-else-if="group?.routingGroupId"
    @click.capture="guardLockedInteraction"
    @keydown.capture="guardLockedInteraction"
  >
    <!-- Routing Group Column -->
    <div class="routing-group">
      <ion-card class="info">
        <div>
          <ion-card-header>
            <ion-card-title v-show="!isGroupNameUpdating">{{ groupName }}</ion-card-title>
            <ion-input v-if="!isSandbox" ref="groupNameRef" :class="isGroupNameUpdating ? 'name' : ''" v-show="isGroupNameUpdating" aria-label="group name" v-model="groupName" @ionInput="hasUnsavedChanges = true"></ion-input>
            <ion-card-subtitle>{{ group.routingGroupId }}</ion-card-subtitle>
            <p v-show="!isDescUpdating && group.description" class="group-description">{{ group.description }}</p>
            <ion-textarea v-if="!isSandbox" v-show="isDescUpdating" ref="descRef" class="group-description-input" aria-label="description" :auto-grow="true" v-model="description" @ionInput="hasUnsavedChanges = true" @keydown.enter.exact.prevent="updateGroupDescription()"></ion-textarea>
          </ion-card-header>
          <div class="ion-padding">
            <ion-button v-if="!isSandbox" v-show="!isGroupNameUpdating" fill="outline" size="small" @click="editGroupName()">
              <ion-icon slot="start" :icon="pencilOutline" />
              {{ translate("Rename") }}
            </ion-button>
            <ion-button v-if="!isSandbox" v-show="isGroupNameUpdating" fill="outline" size="small" @click="updateGroupName()">
              <ion-icon slot="start" :icon="saveOutline" />
              {{ translate("Save") }}
            </ion-button>
            <ion-button v-if="!isSandbox" v-show="!isDescUpdating" fill="outline" size="small" @click="editGroupDescription()">
              <ion-icon slot="start" :icon="group.description ? pencilOutline : addCircleOutline" />
              {{ group.description ? translate("Edit description") : translate("Add description") }}
            </ion-button>
            <ion-button v-if="!isSandbox" v-show="isDescUpdating" fill="outline" size="small" @click="updateGroupDescription()">
              <ion-icon slot="start" :icon="saveOutline" />
              {{ translate("Save description") }}
            </ion-button>
            <ion-button v-if="!isSandbox" fill="outline" size="small" :disabled="liveActionsBlocked" @click="cloneGroup()">
              <ion-icon slot="start" :icon="copyOutline" />
              {{ translate("Clone") }}
            </ion-button>
          </div>
          <ion-item v-if="isSandbox && sim.activeVariationId" class="variation-diff-summary" lines="none" color="light">
            <ion-icon slot="start" :icon="gitCompareOutline" color="primary" />
            <ion-label class="ion-text-wrap">
              <h3>{{ translate("Variation changes") }}</h3>
              <p v-if="variationDiff.total">
                {{ variationDiff.total }} {{ translate(variationDiff.total === 1 ? "difference from baseline" : "differences from baseline") }}
                <template v-if="sim.isDirty"> — {{ translate("Unsaved edits") }}</template>
              </p>
              <p v-else>{{ translate("Matches the baseline") }}</p>
            </ion-label>
            <ion-button slot="end" size="small" fill="outline" @click="openVariationDiff()">
              {{ translate("Review") }}
            </ion-button>
          </ion-item>
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
            <ion-select :label="translate('Status')" label-placement="stacked" interface="popover" :interface-options="{ subHeader: translate('Status') }" :disabled="liveActionsBlocked" :value="job.paused || 'Y'" @ionChange="updateGroupStatus($event)">
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
            <ion-button fill="outline" size="small" color="medium" :disabled="liveActionsBlocked" @click="openScheduleModal()">
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
          <ion-button fill="outline" color="dark" slot="start" :disabled="liveActionsBlocked" @click="runNow()">{{ translate("Run now") }}</ion-button>
          <ion-button fill="clear" color="medium" slot="end" @click="showGroupHistory()">
            <ion-icon slot="start" :icon="timeOutline" />
            {{ translate("History") }}
          </ion-button>
        </ion-item>
      </ion-card>

      <ion-card v-if="!isSandbox && testDriveEnabled && userStore.hasPermission('ROUTING_TEST_DRIVE_VIEW')">
        <ion-card-header>
          <ion-card-subtitle>{{ translate("Test drive") }}</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          {{ translate("Test drive your routing group to see how specific orders are routed. Try different kind of orders to quickly verify if all flows are working as expected.") }}
        </ion-card-content>
        <ion-item lines="none">
          <ion-button fill="outline" expand="block" :disabled="liveActionsBlocked" @click="router.push(`/order-routing/${group.routingGroupId}/test`)">
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
            <ion-chip slot="end" outline v-if="group.routings">
              {{ (index as number) + 1 }}/{{ group.routings.length }}
              <ion-reorder @pointerdown="isReordering = true" />
            </ion-chip>
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
            <ion-input ref="routeNameRef" :class="isRouteNameUpdating ? 'name' : ''" v-show="isRouteNameUpdating" aria-label="route name" v-model="routeName" @ionInput="hasUnsavedChanges = true"></ion-input>
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
          <ion-select :label="translate('Status')" label-placement="stacked" interface="popover" :interface-options="{ subHeader: translate('Status') }" :value="routingStatus" @ionChange="updateRoutingStatus($event.detail.value)">
            <ion-select-option value="ROUTING_ACTIVE">{{ translate("Active") }}</ion-select-option>
            <ion-select-option value="ROUTING_DRAFT">{{ translate("Draft") }}</ion-select-option>
            <ion-select-option value="ROUTING_ARCHIVED">{{ translate("Archive") }}</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-card>
      <div class="config">
        <section class="condition">
          <RoutingConfigSectionCard
            :card="routeFiltersSectionCard"
            :dirty="isOrderConditionCardDirty('ENTCT_FILTER')"
            :show-context="false"
          >
            <template #header-actions>
              <ion-button size="default" v-if="orderRoutingFilterOptions && Object.keys(orderRoutingFilterOptions).length" slot="end" fill="clear" @click="addOrderRouteFilterOptions('ORD_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                  <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </template>
            <template #empty>
            <p class="empty-state">
              {{ translate("All orders in all parkings will be attempted if no filter is applied.") }}
              <ion-button fill="clear" @click="addOrderRouteFilterOptions('ORD_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                  {{ translate("Add filters") }}
                  <ion-icon slot="end" :icon="optionsOutline"/>
                </ion-button>
            </p>
            </template>
            <template #item="{ item }">
            <ion-item v-if="item.target.endsWith('.PROD_CATEGORY')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select multiple :placeholder="translate('product category')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'PROD_CATEGORY', true)">
                <div slot="label">
                  {{ translate("Product Category") }}
                </div>
                <ion-select-option v-for="(category, productCategoryId) in catalogCategories" :key="productCategoryId" :value="productCategoryId">{{ category.categoryName || productCategoryId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.PROD_CATEGORY_EXCLUDED')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select multiple :placeholder="translate('product category')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PROD_CATEGORY_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'PROD_CATEGORY_EXCLUDED', true)">
                <div slot="label">
                  <ion-label>{{ translate("Product Category") }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(category, productCategoryId) in catalogCategories" :key="productCategoryId" :value="productCategoryId">{{ category.categoryName || productCategoryId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.QUEUE')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select multiple :placeholder="translate('queue')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'QUEUE', true)">
                <div slot="label">
                  {{ translate("Queue") }}
                </div>
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.QUEUE_EXCLUDED')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select multiple :placeholder="translate('queue')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'QUEUE_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'QUEUE_EXCLUDED', true)">
                <div slot="label">
                  <ion-label>{{ translate("Queue") }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.SHIPPING_METHOD')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select multiple :placeholder="translate('shipping method')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SHIPPING_METHOD', true)">
                <div slot="label">
                  {{ translate("Shipping method") }}
                </div>
                <ion-select-option v-for="(shippingMethod, shippingMethodId) in shippingMethods" :key="shippingMethodId" :value="shippingMethodId">{{ shippingMethod.description || shippingMethodId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.SHIPPING_METHOD_EXCLUDED')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select multiple :placeholder="translate('shipping method')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SHIPPING_METHOD_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SHIPPING_METHOD_EXCLUDED', true)">
                <div slot="label">
                  <ion-label>{{ translate('Shipping method') }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(shippingMethod, shippingMethodId) in shippingMethods" :key="shippingMethodId" :value="shippingMethodId">{{ shippingMethod.description || shippingMethodId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.PRIORITY')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select :placeholder="translate('priority')" interface="popover" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'PRIORITY').fieldValue" @ionChange="updateOrderFilterValue($event, 'PRIORITY')">
                <div slot="label">
                  {{ translate("Order priority") }}
                </div>
                <ion-select-option value="HIGH">{{ translate("High") }}</ion-select-option>
                <ion-select-option value="MEDIUM">{{ translate("Medium") }}</ion-select-option>
                <ion-select-option value="Low">{{ translate("Low") }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.PRIORITY_EXCLUDED')" :class="{ 'dirty-setting-row': item.dirty }">
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
            <ion-item v-else-if="item.target.endsWith('.PROMISE_DATE')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-label>{{ translate("Promise date") }}</ion-label>
              <ion-chip outline @click="selectPromiseFilterValue($event)">
                {{ getPromiseDateValue() }}
              </ion-chip>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.PROMISE_DATE_EXCLUDED')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-label>{{ translate("Promise date") }}</ion-label>
              <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
              <ion-chip outline @click="selectPromiseFilterValue($event, 'excluded')">
                {{ getPromiseDateValue("excluded") }}
              </ion-chip>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.SALES_CHANNEL')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select multiple :placeholder="translate('sales channel')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SALES_CHANNEL', true)">
                <div slot="label">
                  {{ translate("Sales Channel") }}
                </div>
                <ion-select-option v-for="(enumInfo, enumId) in enums['ORDER_SALES_CHANNEL']" :key="enumId" :value="enumId">{{ enumInfo.description || enumInfo.enumId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.SALES_CHANNEL_EXCLUDED')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select multiple :placeholder="translate('sales channel')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'SALES_CHANNEL_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'SALES_CHANNEL_EXCLUDED', true)">
                <div slot="label">
                  <ion-label>{{ translate('Sales Channel') }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(enumInfo, enumId) in enums['ORDER_SALES_CHANNEL']" :key="enumId" :value="enumId">{{ enumInfo.description || enumInfo.enumId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.ORIGIN_FACILITY_GROUP')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select multiple :placeholder="translate('facility group')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'ORIGIN_FACILITY_GROUP', true)">
                <div slot="label">
                  {{ translate("Origin Facility Group") }}
                </div>
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in facilityGroups" :key="facilityGroupId" :value="facilityGroupId">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.ORIGIN_FACILITY_GROUP_EXCLUDED')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select multiple :placeholder="translate('facility group')" interface="popover" :selected-text="getSelectedValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP_EXCLUDED')" :value="getFilterValue(orderRoutingFilterOptions, ruleEnums, 'ORIGIN_FACILITY_GROUP_EXCLUDED').fieldValue?.split(',')" @ionChange="updateOrderFilterValue($event, 'ORIGIN_FACILITY_GROUP_EXCLUDED', true)">
                <div slot="label">
                  <ion-label>{{ translate('Origin Facility Group') }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in facilityGroups" :key="facilityGroupId" :value="facilityGroupId">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
              </ion-select>
            </ion-item>
            </template>
          </RoutingConfigSectionCard>
          <RoutingConfigSectionCard
            :card="routeSortSectionCard"
            :dirty="isOrderConditionCardDirty('ENTCT_SORT_BY')"
            reorderable
            :show-context="false"
            @reorder="doRouteSortReorder"
          >
            <template #header-actions>
              <ion-button size="default" v-if="orderRoutingSortOptions && Object.keys(orderRoutingSortOptions).length" slot="end" fill="clear" @click="addOrderRouteFilterOptions('ORD_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                  <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </template>
            <template #empty>
            <p class="empty-state">
              {{ translate("Orders will be brokered based on order date if no sorting is specified.") }}
              <ion-button fill="clear" @click="addOrderRouteFilterOptions('ORD_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                  {{ translate("Add sorting") }}
                  <ion-icon slot="end" :icon="optionsOutline"/>
                </ion-button>
            </p>
            </template>
            <template #item="{ item }">
              <ion-item :class="{ 'dirty-setting-row': item.dirty }">
                <ion-label>{{ item.label }}</ion-label>
                <ion-reorder @pointerdown="isReordering = true" />
              </ion-item>
            </template>
          </RoutingConfigSectionCard>
        </section>
        <section class="rules">
          <ion-list>
            <ion-list-header>
              <ion-label>{{ translate("Routing rules") }}</ion-label>
            </ion-list-header>
              
            <ion-reorder-group @ionItemReorder="doReorder($event)" :disabled="false">
              <ion-item
                class="rule-item"
                :class="{ 'dirty-row': isRuleDirty(rule) }"
                lines="full"
                v-for="rule in rulesForReorder"
                :key="ruleKey(rule)"
                :disabled="isReordering"
                :color="ruleKey(rule) === activeRuleId ? 'light' : ''"
                @click="selectRule(rule)"
                button
              >
                <ion-label>
                  {{ rule.ruleName }}
                  <p
                    class="rule-status"
                    :class="{
                      active: rule.statusId === 'RULE_ACTIVE',
                      archived: rule.statusId === 'RULE_ARCHIVED',
                      draft: rule.statusId !== 'RULE_ACTIVE' && rule.statusId !== 'RULE_ARCHIVED'
                    }"
                  >
                    {{ rule.statusId === "RULE_ACTIVE" ? translate("Active") : rule.statusId === "RULE_ARCHIVED" ? translate("Archived") : translate("Draft") }}
                  </p>
                </ion-label>
                <ion-note v-if="isRuleDirty(rule)" slot="end" color="warning">{{ translate("Changed") }}</ion-note>
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
      <div v-if="ruleKey(activeRule)">
        <ion-card class="summary">
          <ion-item class="title" lines="none">
            <ion-label>
              <p>{{ getRuleIndex() }}</p>
              <h1 v-show="!isRuleNameUpdating">{{ selectedRoutingRule.ruleName }}</h1>
            </ion-label>
            <!-- Added class as we can't change the background of ion-input with css property, and we need to change the background to show the user that now this value is editable -->
            <ion-input ref="ruleNameRef" :class="isRuleNameUpdating ? 'name' : ''" v-show="isRuleNameUpdating" aria-label="rule name" v-model="ruleName" @ionInput="hasUnsavedChanges = true"></ion-input>
          </ion-item>
          <div class="actions">
            <ion-button size="small" @click="isRuleNameUpdating ? updateRuleName(ruleKey(selectedRoutingRule)) : editRuleName()" fill="outline">
              <ion-icon slot="start" :icon="isRuleNameUpdating ? saveOutline : pencilOutline" />
              {{ isRuleNameUpdating ? translate("Save") : translate("Rename") }}
            </ion-button>
          </div>
          <ion-item lines="none" class="status">
            <ion-icon slot="start" :icon="pulseOutline" />
            <ion-select :label="translate('Status')" label-placement="stacked" interface="popover" :value="getRuleStatus(ruleKey(selectedRoutingRule))" :interface-options="{ subHeader: translate('Status') }" @ionChange="updateRuleStatus($event, ruleKey(selectedRoutingRule))">
              <ion-select-option value="RULE_ACTIVE">{{ translate("Active") }}</ion-select-option>
              <ion-select-option value="RULE_DRAFT">{{ translate("Draft") }}</ion-select-option>
              <ion-select-option value="RULE_ARCHIVED">{{ translate("Archived") }}</ion-select-option>
            </ion-select>
          </ion-item>
        </ion-card>
        <section class="config">
          <RoutingConfigSectionCard
            class="filter"
            :card="ruleFiltersSectionCard"
            :dirty="isRuleConditionCardDirty('ENTCT_FILTER')"
            :show-context="false"
          >
            <template #header-actions>
              <ion-button size="default" v-if="isInventoryRuleFiltersApplied()" slot="end" fill="clear" @click="addInventoryFilterOptions('INV_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </template>
            <template #empty>
            <p class="empty-state">
              {{ translate("All facilities enabled for online fulfillment will be attempted for routing if no filter is applied.") }}<br /><br />
              <span><a target="_blank" rel="noopener noreferrer" href="https://docs.hotwax.co/documents/v/system-admins/administration/facilities/configure-fulfillment">{{ translate("Learn more") }}</a>{{ translate(" about enabling a facility for online fulfillment.") }}</span>
              <ion-button fill="clear" @click="addInventoryFilterOptions('INV_FILTER_PRM_TYPE', 'ENTCT_FILTER', 'Filters')">
                {{ translate("Add filters") }}
                <ion-icon slot="end" :icon="optionsOutline"/>
              </ion-button>
            </p>
            </template>
            <template #item="{ item }">
            <ion-item v-if="item.target.endsWith('.FACILITY_GROUP')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select :placeholder="translate('facility group')" interface="popover" :label="translate('Group')" :selected-text="getSelectedValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP') || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP').fieldValue" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP').fieldValue" @ionChange="updateRuleFilterValue($event, 'FACILITY_GROUP')">
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in brokeringFacilityGroups" :key="facilityGroupId" :value="facilityGroupId" :disabled="isFacilityGroupSelected(facilityGroupId, 'included')">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.FACILITY_GROUP_EXCLUDED')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select :placeholder="translate('facility group')" interface="popover" :selected-text="getSelectedValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED') || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED').fieldValue" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED').fieldValue" @ionChange="updateRuleFilterValue($event, 'FACILITY_GROUP_EXCLUDED')">
                <div slot="label">
                  <ion-label>{{ translate("Group") }}</ion-label>
                  <ion-note color="danger">{{ translate("Excluded") }}</ion-note>
                </div>
                <ion-select-option v-for="(facilityGroup, facilityGroupId) in brokeringFacilityGroups" :key="facilityGroupId" :value="facilityGroupId" :disabled="isFacilityGroupSelected(facilityGroupId, 'excluded')">{{ facilityGroup.facilityGroupName || facilityGroupId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.PROXIMITY')" :class="{ 'dirty-setting-row': item.dirty }">
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
            <ion-item v-else-if="item.target.endsWith('.BRK_SAFETY_STOCK')" :class="{ 'dirty-setting-row': item.dirty }">
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

            <ion-item v-else-if="item.target.endsWith('.FACILITY_ORDER_LIMIT')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-toggle :checked="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'FACILITY_ORDER_LIMIT').fieldValue === 'Y'" @ionChange="updateRuleFilterValue($event, 'FACILITY_ORDER_LIMIT')">
                <ion-label class="ion-text-wrap">
                  {{ translate("Turn off the facility order limit check") }}
                </ion-label>
              </ion-toggle>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.SHIP_THRESHOLD')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-label>{{ translate('Shipment threshold check') }}</ion-label>
              <ion-chip slot="end" outline @click="selectValue('SHIP_THRESHOLD', 'Add shipment threshold check')">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "SHIP_THRESHOLD").fieldValue || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "SHIP_THRESHOLD").fieldValue == 0 ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "SHIP_THRESHOLD").fieldValue : "-" }}</ion-chip>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.WOS')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-label>{{ translate('Week of Supply') }}</ion-label>
              <ion-chip slot="end" outline @click="selectValue('WOS', 'Add week of supply')">{{ getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "WOS").fieldValue || getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "WOS").fieldValue == 0 ? getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, "WOS").fieldValue : "-" }}</ion-chip>
            </ion-item>
            <ion-item v-else-if="item.target.endsWith('.CARRIER_POSTAL_CODE_MAPPING')" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-label>{{ translate('Carrier postal code mapping') }}</ion-label>
              <div slot="end">
                <ion-chip outline @click.stop="chipClickEvent(cpcmOperatorRef)">
                  <ion-select @click.stop ref="cpcmOperatorRef" :placeholder="translate('operator')" aria-label="CPCM operator" interface="popover" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'CARRIER_POSTAL_CODE_MAPPING').operator" @ionChange="updateOperator($event, 'CARRIER_POSTAL_CODE_MAPPING')">
                    <ion-select-option value="less">{{ translate("less than") }}</ion-select-option>
                    <ion-select-option value="less-equals">{{ translate("less than or equal to") }}</ion-select-option>
                  </ion-select>
                </ion-chip>
                <ion-chip outline @click.stop="chipClickEvent(cpcmZoneRef)">
                  <ion-select @click.stop ref="cpcmZoneRef" :placeholder="translate('Zone')" aria-label="CPCM zone" interface="popover" :value="getFilterValue(inventoryRuleFilterOptions, conditionFilterEnums, 'CARRIER_POSTAL_CODE_MAPPING').fieldValue" @ionChange="updateRuleFilterValue($event, 'CARRIER_POSTAL_CODE_MAPPING')">
                    <ion-select-option v-for="zone in DEMO_CPCM_ZONE_OPTIONS" :key="zone" :value="zone">
                      {{ translate(zone === 1 ? "Zone 1 (closest)" : zone === 4 ? "Zone 4 (furthest)" : `Zone ${zone}`) }}
                    </ion-select-option>
                  </ion-select>
                </ion-chip>
              </div>
            </ion-item>
            </template>
          </RoutingConfigSectionCard>
          <RoutingConfigSectionCard
            class="sort"
            :card="ruleSortSectionCard"
            :dirty="isRuleConditionCardDirty('ENTCT_SORT_BY')"
            reorderable
            :show-context="false"
            @reorder="doConditionSortReorder"
          >
            <template #header-actions>
              <ion-button size="default" v-if="inventoryRuleSortOptions && Object.keys(inventoryRuleSortOptions).length" slot="end" fill="clear" @click="addInventoryFilterOptions('INV_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                <ion-icon slot="icon-only" :icon="optionsOutline"/>
              </ion-button>
            </template>
            <template #empty>
            <p class="empty-state">
              {{ translate("Facilities will be sorted based on creation date if no sorting preferences are applied.") }}
              <ion-button fill="clear" @click="addInventoryFilterOptions('INV_SORT_PARAM_TYPE', 'ENTCT_SORT_BY', 'Sort')">
                {{ translate("Add sorting") }}
                <ion-icon slot="end" :icon="optionsOutline"/>
              </ion-button>
            </p>
            </template>
            <template #item="{ item }">
              <ion-item :class="{ 'dirty-setting-row': item.dirty }">
                <ion-label>{{ item.label }}</ion-label>
                <ion-reorder @pointerdown="isReordering = true" />
              </ion-item>
            </template>
          </RoutingConfigSectionCard>
          <RoutingConfigSectionCard
            class="split"
            :card="partialSectionCard"
            :dirty="isPartialAvailabilityDirty()"
            :show-context="false"
          >
            <template #before-items>
            <ion-card-content>
              {{ translate("Select if partial allocation should be allowed in this routing rule") }}
            </ion-card-content>
            <ion-item v-show="isPromiseDateFilterApplied()" lines="none">
              <ion-label class="ion-text-wrap">
                <p>{{ translate("Partial allocation cannot be disabled. Orders are filtered by item when filtering by promise date.") }}</p>
              </ion-label>
            </ion-item>
            </template>
            <template #item="{ item }">
            <ion-item v-if="item.target === 'selectedRule.partialAllocation'" lines="none" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-toggle :disabled="isPromiseDateFilterApplied()" :checked="activeRule.assignmentEnumId === 'ORA_MULTI'" @ionChange="updatePartialAllocation($event.detail.checked)">{{ translate("Allow partial allocation") }}</ion-toggle>
            </ion-item>
            <ion-item v-else lines="none" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-toggle :disabled="activeRule.assignmentEnumId !== 'ORA_MULTI' && !isPromiseDateFilterApplied()" :checked="isPartialGroupItemsAllocationActive()" @ionChange="updatePartialGroupItemsAllocation($event.detail.checked)">{{ translate("Partially allocate grouped items") }}</ion-toggle>
            </ion-item>
            </template>
          </RoutingConfigSectionCard>
          <RoutingConfigSectionCard
            class="unavailable"
            :card="unavailableSectionCard"
            :dirty="isUnavailableItemsDirty()"
            :show-context="false"
          >
            <template #item="{ item }">
            <ion-item v-if="item.target === 'selectedRule.unavailableItemsAction'" lines="none" :class="{ 'dirty-setting-row': item.dirty }">
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
            <ion-item v-else-if="item.target === 'selectedRule.unavailableItemsQueueId'" lines="none" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-select :placeholder="translate('queue')" :label="translate('Queue')" interface="popover" :value="inventoryRuleActions[ruleActionType]?.actionValue" @ionChange="updateRuleActionValue($event.detail.value)">
                <ion-select-option v-for="(facility, facilityId) in facilities" :key="facilityId" :value="facilityId">{{ facility.facilityName || facilityId }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item v-else-if="item.target === 'selectedRule.clearAutoCancelDays'" lines="none" :class="{ 'dirty-setting-row': item.dirty }">
              <ion-toggle :checked="JSON.parse(inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue ? inventoryRuleActions[actionEnums['RM_AUTO_CANCEL_DATE'].id]?.actionValue : false)" @ionChange="clearAutoCancelDays($event.detail.checked)">{{ translate("Clear auto cancel days") }}</ion-toggle>
            </ion-item>
            <ion-item v-else lines="none" :class="{ 'dirty-setting-row': item.dirty }">
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
            </template>
          </RoutingConfigSectionCard>
        </section>
      </div>
    </div>
    <!-- Live save is triggered on demand from the page header (RoutingDetailCanvas); variations save
         via the Variations rail. No floating FAB. -->
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

        <div v-if="draftAssistantEnabled" class="action-prompt">
          <ion-icon :icon="sparklesOutline" />
          <p>{{ translate("Ask the assistant to help you create or modify rules") }}</p>
        </div>
      </div>
    </div>
  </div>
  <VariationDiffModal
    :is-open="showVariationDiff"
    :diff="variationDiff"
    :dirty="Boolean(sim.isDirty)"
    @dismiss="showVariationDiff = false"
    @restore-section="restoreVariationDiffSection"
    @restore-all="confirmRestoreVariation"
  />
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
  IonTextarea,
  IonToggle,
  IonFab,
  IonFabButton,
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
  speedometerOutline,
  gitCompareOutline
} from 'ionicons/icons';
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';
import { useCircuitStore } from '@/store/circuit';
import { orderRoutingStore } from '@/store/orderRoutingStore';
import { productStore } from '@/store/productStore';
import { useUserStore } from '@/store/userStore';
import { useUtilStore } from '@/store/utilStore';
import { simulationStore, registerWorkingFlushHook } from '@/store/simulationStore';
import { useSimReferenceStore } from '@/store/simReferenceStore';
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
import RoutingConfigSectionCard from "@/components/circuit/RoutingConfigSectionCard.vue";
import RoutingGroupEditorSkeleton from "@/components/circuit/RoutingGroupEditorSkeleton.vue";
import VariationDiffModal from "@/components/simulation/VariationDiffModal.vue";
import { DraftAssistantService } from "@/services/DraftAssistantService";
import {
  RoutingPageOperationGuard,
  type RoutingPageOperationIdentity
} from "@/utils/routingPageOperationGuard";
import type { DraftConversationMessage, DraftProposal } from "@/types/draft";
import { buildCircuitProposalContextCards } from "@/utils/circuitProposalContext";
import type { RoutingConfigSection } from "@/types/routingConfigSection";
import { routingConfigTargetLabel } from "@/utils/routingConfigSection";
import { buildRoutingRulesBindings, buildRoutingRulesManifest } from "@/utils/routingRulesManifest";
import { buildRoutingAgentSnapshot } from "@/composables/useRoutingAgentSnapshot";
import {
  DEFAULT_ACTION_ENUMS,
  DEFAULT_CONDITION_FILTER_ENUMS,
  DEFAULT_CONDITION_SORT_ENUMS,
  DEFAULT_RULE_ENUMS,
  parseRoutingEditorEnvJson
} from "@/utils/routingEditorEnv";
import { isFeatureEnabled } from "@/utils/simConfig";
import { DEMO_CPCM_ZONE_OPTIONS } from "@/utils/demoCarrierPostalCodeMapping";
import {
  applyPendingRoutingInlineEdits,
  applyRoutingProposalPreview,
  canonicalRoutingEditorRoute,
  isRoutingRuleDraftDirty,
  prepareRoutingGroupSaveCommit,
  projectRuleForEditor,
  replaceWorkingEntry,
  routingEditorReferenceMaps,
  routingEditorCodeLabel,
  routingGroupScheduleWorkingCopy,
  routingWorkingKey,
  ruleWorkingKey,
  settleRoutingEditorDiscard,
  serializeRoutingWorkingCopy,
  serializeRuleWorkingCopy,
  updateRoutingFilterCondition
} from "@/utils/routingWorkingCopy";
import {
  buildVariationConfigDiff,
  restoreVariationSection,
  restoreVariationToBaseline,
  type VariationDiffTarget
} from "@/utils/variationConfigDiff";

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
  },
  interactionLocked: {
    type: Boolean,
    default: false
  }
})

// Emitted so the host (RoutingDetailCanvas) can drive an explicit Save button in the page header
// and reflect the unsaved-changes state. Live-mode only; variations save via the Variations rail.
const emit = defineEmits(["dirtyChange"]);

const circuitStore = useCircuitStore();
const routingStore = orderRoutingStore();
const product = productStore();
const userStore = useUserStore();
const utilStore = useUtilStore();
const sim = simulationStore();
const showVariationDiff = ref(false);
const variationDiff = computed(() => buildVariationConfigDiff(sim.baseline, sim.working));
const simReferences = useSimReferenceStore();
const draftAssistantEnabled = isFeatureEnabled("draftAssistant");
const testDriveEnabled = isFeatureEnabled("testDrive");

function openVariationDiff() {
  flushEditorDraft();
  showVariationDiff.value = true;
}

async function restoreVariationDiffSection(target: VariationDiffTarget) {
  flushEditorDraft();
  restoreObjectInPlace(sim.working, restoreVariationSection(sim.working, sim.baseline, target));
  await initializeFromWorking();
  hasUnsavedChanges.value = true;
  commonUtil.showToast(translate("Section reset to baseline. Update the variation to keep this change."));
}

async function confirmRestoreVariation() {
  const alert = await alertController.create({
    header: translate("Reset variation to baseline?"),
    message: translate("Every variation difference will be removed from the working copy. Update the variation to keep this change."),
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      { text: translate("Reset"), role: "destructive" }
    ]
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  if (role !== "destructive") return;
  flushEditorDraft();
  restoreObjectInPlace(sim.working, restoreVariationToBaseline(sim.working, sim.baseline));
  await initializeFromWorking();
  hasUnsavedChanges.value = true;
  commonUtil.showToast(translate("Variation reset to baseline. Update the variation to keep this change."));
}

// These descriptors are the stable UI identity for each routing JSON section. The canvas supplies
// editable controls through the shared card's slot; Circuit supplies a normalized JSON slice to the
// same component in read-only mode.
const routeFiltersSectionCard = computed<RoutingConfigSection>(() => ({
  key: "canvas:route:filters",
  eyebrow: "Routing",
  title: "Filters",
  kind: "filters",
  items: routingSectionItems(
    orderRoutingFilterOptions.value,
    ruleEnums,
    "ORD_FILTER_PRM_TYPE",
    "route.orderFilters",
    "filters",
    (code, parameter) => isOrderConditionCodeDirty("ENTCT_FILTER", code)
      || isOrderConditionDirty("ENTCT_FILTER", parameter)
  )
}));
const routeSortSectionCard = computed<RoutingConfigSection>(() => ({
  key: "canvas:route:sort",
  eyebrow: "Routing",
  title: "Sort",
  kind: "sort",
  items: routingSectionItems(
    orderRoutingSortOptions.value,
    ruleEnums,
    "ORD_SORT_PARAM_TYPE",
    "route.orderSorts",
    "sort",
    (code) => isOrderConditionCodeDirty("ENTCT_SORT_BY", code)
  )
}));
const ruleFiltersSectionCard = computed<RoutingConfigSection>(() => ({
  key: "canvas:rule:filters",
  eyebrow: "Routing rule",
  title: "Filters",
  kind: "filters",
  items: routingSectionItems(
    inventoryRuleFilterOptions.value,
    conditionFilterEnums,
    "INV_FILTER_PRM_TYPE",
    "selectedRule.inventoryFilters",
    "filters",
    (code, parameter) => isRuleConditionCodeDirty("ENTCT_FILTER", code)
      || isRuleConditionDirty("ENTCT_FILTER", parameter)
      || (parameter === "PROXIMITY" && isRuleConditionDirty("ENTCT_FILTER", "MEASUREMENT_SYSTEM"))
  ).filter((item) => !item.target.endsWith(".SPLIT_ITEM_GROUP") && !item.target.endsWith(".MEASUREMENT_SYSTEM"))
}));
const ruleSortSectionCard = computed<RoutingConfigSection>(() => ({
  key: "canvas:rule:sort",
  eyebrow: "Routing rule",
  title: "Sort",
  kind: "sort",
  items: routingSectionItems(
    inventoryRuleSortOptions.value,
    conditionSortEnums,
    "INV_SORT_PARAM_TYPE",
    "selectedRule.inventorySorts",
    "sort",
    (code) => isRuleConditionCodeDirty("ENTCT_SORT_BY", code)
  )
}));
const partialSectionCard = computed<RoutingConfigSection>(() => ({
  key: "canvas:rule:partial",
  eyebrow: "Routing rule",
  title: "Partially available",
  kind: "partial",
  items: [
    {
      target: "selectedRule.partialAllocation",
      label: "Allow partial allocation",
      value: activeRule.value?.assignmentEnumId === "ORA_MULTI" ? "Enabled" : "Disabled",
      dirty: isPartialAllocationDirty()
    },
    {
      target: "selectedRule.partialGroupItemsAllocation",
      label: "Partially allocate grouped items",
      value: isPartialGroupItemsAllocationActive() ? "Enabled" : "Disabled",
      dirty: isPartialGroupItemsAllocationDirty()
    }
  ]
}));
const unavailableSectionCard = computed<RoutingConfigSection>(() => ({
  key: "canvas:rule:unavailable",
  eyebrow: "Routing rule",
  title: "Unavailable items",
  kind: "unavailable",
  items: unavailableSectionItems()
}));

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
const ruleName = ref("");

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
function createClientUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    return (token === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}
const actionEnums = parseRoutingEditorEnvJson(import.meta.env.VITE_RULE_ACTION_ENUMS as string | undefined, DEFAULT_ACTION_ENUMS);
const conditionFilterEnums = parseRoutingEditorEnvJson(import.meta.env.VITE_RULE_FILTER_ENUMS as string | undefined, DEFAULT_CONDITION_FILTER_ENUMS);
const conditionSortEnums = parseRoutingEditorEnvJson(import.meta.env.VITE_RULE_SORT_ENUMS as string | undefined, DEFAULT_CONDITION_SORT_ENUMS);

const groupName = ref("");
const isGroupNameUpdating = ref(false);
const groupNameRef = ref();
const description = ref("");
const isDescUpdating = ref(false);
const descRef = ref();
// The routed view seeds the group id before Ionic's enter lifecycle starts the backend request.
// Begin in a local loading state so direct detail entries render the final card geometry immediately
// instead of flashing the empty canvas and then shifting into the three-column editor.
const isLoadingGroup = ref(Boolean(props.routingGroupId));
const isReordering = ref(false);
const job = ref({}) as any;
const groupHistory = ref([]) as any;

const ruleEnums = parseRoutingEditorEnvJson(import.meta.env.VITE_RULE_ENUMS as string | undefined, DEFAULT_RULE_ENUMS);

const editorReferenceMaps = computed(() => routingEditorReferenceMaps(
  isSandbox.value,
  {
    facilities: simReferences.getVirtualFacilities,
    facilityGroups: simReferences.getFacilityGroups,
    shippingMethods: simReferences.getShippingMethods,
    salesChannels: simReferences.getSalesChannels
  },
  {
    facilities: product.getVirtualFacilities,
    facilityGroups: product.getFacilityGroups,
    shippingMethods: product.getShippingMethods,
    salesChannels: utilStore.getEnums?.ORDER_SALES_CHANNEL || {},
    catalogCategories: (utilStore.getCatalogCategories || {}) as Record<string, any>
  }
));
const facilities = computed(() => editorReferenceMaps.value.facilities);
const enums = computed(() => isSandbox.value
  ? { ORDER_SALES_CHANNEL: editorReferenceMaps.value.salesChannels }
  : utilStore.getEnums);
const shippingMethods = computed(() => editorReferenceMaps.value.shippingMethods);
const facilityGroups = computed(() => editorReferenceMaps.value.facilityGroups);
const brokeringFacilityGroups = computed(() => editorReferenceMaps.value.facilityGroups);
const routingHistory = computed(() => routingStore.getRoutingHistory)
const userProfile = computed(() => userStore.getUserProfile)

const operatorRef = ref()
const measurementRef = ref()
const cpcmOperatorRef = ref()
const cpcmZoneRef = ref()

const currentRoutingGroup: any = computed(() => routingStore.getCurrentRoutingGroup)

// Prefer live OMS status descriptions, but never let a system ID leak into the UI while reference
// data is loading or unavailable. Simulation statuses always use the same display-only fallback.
const getStatusDesc = computed(() => (id: string) => {
  const description = isSandbox.value ? "" : utilStore.getStatusDesc(id)
  return translate(description && description !== id ? description : routingEditorCodeLabel(id))
})
const routingStatus = computed(() => activeRouting.value?.statusId)
const selectedRoutingRule = computed(() => activeRule.value || {})
const getRuleStatus = computed(() => (ruleId: string) => rulesForReorder.value.find((rule: Rule) => ruleKey(rule) === ruleId)?.statusId)

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
  if (!draftAssistantEnabled) {
    return {
      proposal: null,
      message: translate("Draft assistant is unavailable for this deployment.")
    };
  }
  if (!activeRouting.value?.orderRoutingId) {
    return {
      proposal: null,
      message: translate("Select a routing before drafting changes.")
    };
  }

  const proposalContext = captureProposalContext();
  // Fold the visible projection into the selected working copy before building either an inquiry or
  // edit manifest. In sandbox mode this is sim.working; no live routing-store write is involved.
  flushEditorDraft();
  const manifest = await buildCircuitDraftManifest();
  assertCurrentProposalContext(proposalContext);
  circuitStore.setLastPrompt({
    prompt,
    conversationHistory,
    pageCapabilityManifest: manifest,
    outputContract: manifest.outputContract
  });
  const plan = await DraftAssistantService.requestBrokeringRouteDraftOperations(prompt, manifest, { conversationHistory });
  assertCurrentProposalContext(proposalContext);
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

async function applyDraftProposal(proposal: CircuitDraftProposal, proposalContext = captureProposalContext()) {
  if (!draftAssistantEnabled) {
    return {
      appliedCount: 0,
      message: translate("Draft assistant is unavailable for this deployment.")
    };
  }
  if (!activeRouting.value?.orderRoutingId) {
    return {
      appliedCount: 0,
      message: translate("Select a routing before drafting changes.")
    };
  }

  const manifest = await buildCircuitDraftManifest();
  assertCurrentProposalContext(proposalContext);

  const result = await DraftAssistantService.applyDraftProposal(proposal, manifest, {
    createSiblingRouting: async (name: string) => {
      assertCurrentProposalContext(proposalContext);
      // Creating a sibling routing remains a live-only group operation. Variation manifests remove
      // it before apply; this callback also fails closed if a provider returns it anyway.
      if (isSandbox.value) return "";
      return stageNewRouting(name);
    },
    selectRouting: (id: string) => {
      assertCurrentProposalContext(proposalContext);
      // Sandbox: resolve against the working copy, not live routingStore.currentGroup.
      group.value = isSandbox.value ? sim.working : routingStore.currentGroup;
      const created = group.value.routings?.find((r: any) => r.orderRoutingId === id);
      if (created) selectRouting(created);
    },
    buildBindings: () => buildCircuitDraftBindings()
  });

  assertCurrentProposalContext(proposalContext);
  hasUnsavedChanges.value = true;
  // The variation rail computes dirty state from sim.working, so publish the applied projection to
  // that working tree immediately. Persistence still occurs only when the user chooses Update.
  flushEditorDraft();

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

// --- Circuit proposal transaction (stash-and-apply, Stage 3) ---
// A proposal is applied to the working copy IMMEDIATELY so it previews live in the canvas, but as a
// reversible transaction: before applying we snapshot every ref the apply can touch, so Reject can
// restore the pre-proposal working state — preserving the user's own manual edits and reverting ONLY
// the proposal. Accept simply drops the snapshot (the applied change stays in the working copy and
// is committed/reverted later via live Save/Discard or variation Update/Reset).
const proposalSnapshot = ref<any>(null);

function cloneSnapshotValue(value: any) {
  return value === undefined || value === null ? value : JSON.parse(JSON.stringify(value));
}

type ProposalContextIdentity = {
  sandbox: boolean;
  routingGroupId: string;
  variationId: string;
  activationVersion: number;
};

function captureProposalContext(): ProposalContextIdentity {
  return {
    sandbox: isSandbox.value,
    routingGroupId: String(routingGroupId.value || group.value?.routingGroupId || ""),
    variationId: isSandbox.value ? String(sim.activeVariationId || "") : "",
    activationVersion: visibleActivationVersion
  };
}

function isCurrentProposalContext(context: ProposalContextIdentity): boolean {
  return isVisibleEditor
    && context.activationVersion === visibleActivationVersion
    && context.sandbox === isSandbox.value
    && context.routingGroupId === String(routingGroupId.value || group.value?.routingGroupId || "")
    && (!context.sandbox || context.variationId === String(sim.activeVariationId || ""));
}

function assertCurrentProposalContext(context: ProposalContextIdentity): void {
  if (!isCurrentProposalContext(context)) {
    throw new DOMException("The routing context changed while Circuit was preparing changes.", "AbortError");
  }
}

function captureProposalSnapshot() {
  const context = captureProposalContext();
  const editorState = {
    context,
    hadUnsavedChanges: hasUnsavedChanges.value,
    // Editor-local selection + the refs the draft bindings write to.
    activeRoutingId: activeRoutingId.value,
    activeRuleId: activeRuleId.value,
    routeName: routeName.value,
    ruleName: ruleName.value,
    activeRouting: cloneSnapshotValue(activeRouting.value),
    activeRule: cloneSnapshotValue(activeRule.value),
    initialActiveRouting: cloneSnapshotValue(initialActiveRouting.value),
    inventoryRules: cloneSnapshotValue(inventoryRules.value),
    rulesForReorder: cloneSnapshotValue(rulesForReorder.value),
    rulesInformation: cloneSnapshotValue(rulesInformation.value),
    initialRulesInformation: cloneSnapshotValue(initialRulesInformation.value),
    orderRoutingFilterOptions: cloneSnapshotValue(orderRoutingFilterOptions.value),
    orderRoutingSortOptions: cloneSnapshotValue(orderRoutingSortOptions.value),
    inventoryRuleFilterOptions: cloneSnapshotValue(inventoryRuleFilterOptions.value),
    inventoryRuleSortOptions: cloneSnapshotValue(inventoryRuleSortOptions.value),
    inventoryRuleActions: cloneSnapshotValue(inventoryRuleActions.value),
    ruleActionType: ruleActionType.value
  };
  proposalSnapshot.value = isSandbox.value
    ? {
        ...editorState,
        // Snapshot only the active variation tree. Do not read or mutate orderRoutingStore.
        simulationWorking: cloneSnapshotValue(sim.working)
      }
    : {
        ...editorState,
        // Live working copy + active routing pointer; live behavior remains unchanged.
        currentGroup: cloneSnapshotValue(routingStore.currentGroup),
        currentRoutingId: routingStore.currentRoutingId
      };
}

function restoreObjectInPlace(target: any, snapshot: any) {
  Object.keys(target || {}).forEach((key) => delete target[key]);
  Object.assign(target, cloneSnapshotValue(snapshot) || {});
}

function restoreProposalSnapshot() {
  const snap = proposalSnapshot.value;
  if (!snap) return;
  proposalSnapshot.value = null;
  // If a group/variation switch already replaced the authoritative copy, the old preview is stale
  // and must not overwrite the new selection. Its old detached object will be discarded on remount.
  if (!isCurrentProposalContext(snap.context)) return;

  if (snap.context.sandbox) {
    // Preserve the sim.working object identity so its authoritative-rebind watcher does not publish a
    // false clean state. This path never reads or writes orderRoutingStore.
    restoreObjectInPlace(sim.working, snap.simulationWorking);
    group.value = sim.working;
  } else {
    // Restore the live working copy WITHOUT recapturing the baseline, then restore its routing pointer.
    routingStore.setCurrentGroup(snap.currentGroup, true);
    routingStore.setHasUnsavedChanges(snap.hadUnsavedChanges);
    routingStore.setCurrentOrderRouting(snap.currentRoutingId || snap.activeRoutingId || "");
    group.value = currentRoutingGroup.value;
  }
  // Restore editor-local projections verbatim; the raw group stays authoritative and is only
  // changed by flushEditorDraft.
  activeRoutingId.value = snap.activeRoutingId;
  activeRuleId.value = snap.activeRuleId;
  routeName.value = snap.routeName;
  ruleName.value = snap.ruleName || "";
  rulesInformation.value = snap.rulesInformation || {};
  initialRulesInformation.value = snap.initialRulesInformation || {};
  inventoryRules.value = snap.inventoryRules || [];
  rulesForReorder.value = snap.rulesForReorder || [];
  orderRoutingFilterOptions.value = snap.orderRoutingFilterOptions || {};
  orderRoutingSortOptions.value = snap.orderRoutingSortOptions || {};
  inventoryRuleFilterOptions.value = snap.inventoryRuleFilterOptions || {};
  inventoryRuleSortOptions.value = snap.inventoryRuleSortOptions || {};
  inventoryRuleActions.value = snap.inventoryRuleActions || {};
  ruleActionType.value = snap.ruleActionType;
  activeRouting.value = snap.activeRouting || null;
  initialActiveRouting.value = snap.initialActiveRouting || null;
  activeRule.value = snap.activeRule || null;
  hasUnsavedChanges.value = snap.hadUnsavedChanges;
}

// Apply a proposal live to the canvas as a reversible transaction. If a proposal is already live
// (undecided), revert it first so proposals never stack — each revision applies on top of the
// user's manual working state, not on top of the previous proposal.
async function previewDraftProposal(proposal: CircuitDraftProposal) {
  if (!draftAssistantEnabled) {
    return {
      appliedCount: 0,
      message: translate("Draft assistant is unavailable for this deployment.")
    };
  }
  if (proposalSnapshot.value) restoreProposalSnapshot();
  flushEditorDraft();
  const proposalContext = captureProposalContext();
  return applyRoutingProposalPreview(
    captureProposalSnapshot,
    () => applyDraftProposal(proposal, proposalContext),
    restoreProposalSnapshot
  );
}

// Keep the applied proposal in the working copy (stays dirty for the header Save/Discard). Drop the
// stash so the transaction is committed to the working copy.
function acceptDraftProposal() {
  proposalSnapshot.value = null;
}

// Revert the working copy to the pre-proposal state, discarding only the proposal's changes.
function rejectDraftProposal() {
  restoreProposalSnapshot();
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
    utilStore.fetchRoutingEditorEnums(),
    utilStore.fetchStatusInformation()
  ])
  return buildRoutingRulesManifest({
    pageRoute: canonicalRoutingEditorRoute(routingGroupId.value || group.value.routingGroupId || ""),
    assistantContext: isSandbox.value
      ? {
          mode: "variation",
          variationId: String(group.value.variationGroupId || sim.tree?.variationGroupId || sim.working?.variationGroupId || ""),
          routingGroupId: String(group.value.routingGroupId || routingGroupId.value || "")
        }
      : {
          mode: "live",
          routingGroupId: String(group.value.routingGroupId || routingGroupId.value || "")
        },
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
    ...buildRoutingAgentSnapshot(editorReferenceMaps.value)
  });
}

function getSelectedRuleDraftRef() {
  return {
    get value() {
      return activeRule.value || {};
    },
    set value(rule: any) {
      const key = ruleWorkingKey(rule);
      const persistedRule = inventoryRules.value.find((candidate: any) => ruleWorkingKey(candidate) === key);
      if (key && persistedRule && !String(key).startsWith("new:") && !initialRulesInformation.value[key]) {
        initialRulesInformation.value[key] = projectRuleForEditor(persistedRule);
      }
      activeRuleId.value = key;
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

function enumParameterForCode(enumerations: Record<string, any>, code: string) {
  return Object.entries(enumerations)
    .find(([, enumInfo]: [string, any]) => enumInfo?.code === code)?.[0] || code;
}

function conditionContextValue(
  options: Record<string, any>,
  enumerations: Record<string, any>,
  parameter: string,
  condition: any
) {
  const value = condition?.fieldValue;
  if (parameter === "MEASUREMENT_SYSTEM") {
    return value === "IMPERIAL" ? translate("miles") : value === "METRIC" ? translate("kms") : String(value ?? "");
  }
  if (value === true || value === "Y") return translate("Enabled");
  if (value === false || value === "N") return translate("Disabled");
  if (value === undefined || value === null || value === "") return "";
  try {
    return getSelectedValue(options, enumerations, parameter) || String(value);
  } catch {
    return String(value);
  }
}

function proposalRuleKey(card: RoutingConfigSection) {
  if (!card.key.startsWith("rule:")) return "";
  const suffix = `:${card.kind}`;
  return card.key.slice("rule:".length, card.key.endsWith(suffix) ? -suffix.length : undefined);
}

function currentRuleProjection(ruleKeyValue: string) {
  if (ruleKeyValue === activeRuleId.value && activeRule.value) {
    return {
      ...cloneSnapshotValue(activeRule.value),
      inventoryFilters: {
        ENTCT_FILTER: cloneSnapshotValue(inventoryRuleFilterOptions.value),
        ENTCT_SORT_BY: cloneSnapshotValue(inventoryRuleSortOptions.value)
      },
      actions: cloneSnapshotValue(inventoryRuleActions.value)
    };
  }
  const stored = rulesInformation.value[ruleKeyValue];
  if (stored) return stored;
  const raw = inventoryRules.value.find((rule: any) => ruleWorkingKey(rule) === ruleKeyValue);
  return raw ? projectRuleForEditor(raw) : null;
}

function proposalUnavailableItems(actions: Record<string, any>, changedTargets: Set<string>) {
  const nextRuleId = actionEnums.NEXT_RULE?.id;
  const moveToQueueId = actionEnums.MOVE_TO_QUEUE?.id;
  const clearDaysId = actionEnums.RM_AUTO_CANCEL_DATE?.id;
  const autoCancelDaysId = actionEnums.AUTO_CANCEL_DAYS?.id;
  const moveToQueue = Boolean(moveToQueueId && actions?.[moveToQueueId]);
  const clearDays = JSON.parse(actions?.[clearDaysId]?.actionValue || false);
  const queueId = moveToQueue ? actions?.[moveToQueueId]?.actionValue : "";
  return [
    {
      target: "selectedRule.unavailableItemsAction",
      label: "Move items to",
      value: moveToQueue ? "Queue" : nextRuleId && actions?.[nextRuleId] ? "Next rule" : "None",
      dirty: changedTargets.has("selectedRule.unavailableItemsAction")
    },
    ...(moveToQueue ? [{
      target: "selectedRule.unavailableItemsQueueId",
      label: "Queue",
      value: facilities.value[queueId]?.facilityName || String(queueId || ""),
      dirty: changedTargets.has("selectedRule.unavailableItemsQueueId")
    }] : []),
    {
      target: "selectedRule.clearAutoCancelDays",
      label: "Clear auto cancel days",
      value: clearDays ? "Enabled" : "Disabled",
      dirty: changedTargets.has("selectedRule.clearAutoCancelDays")
    },
    ...(!clearDays ? [{
      target: "selectedRule.autoCancelDays",
      label: "Auto cancel days",
      value: String(actions?.[autoCancelDaysId]?.actionValue || "select days"),
      dirty: changedTargets.has("selectedRule.autoCancelDays")
    }] : [])
  ];
}

function getProposalContextCards(proposal: CircuitDraftProposal | null): RoutingConfigSection[] {
  return buildCircuitProposalContextCards(proposal).map((card) => {
    const isRuleCard = card.key.startsWith("rule:");
    const ruleProjection = isRuleCard ? currentRuleProjection(proposalRuleKey(card)) : null;
    const changedTargets = new Set(card.items.map((item) => item.target));

    if (card.kind === "partial" && ruleProjection) {
      const splitCode = conditionFilterEnums.SPLIT_ITEM_GROUP?.code;
      const splitCondition = ruleProjection.inventoryFilters?.ENTCT_FILTER?.[splitCode];
      return {
        ...card,
        items: [
          {
            target: "selectedRule.partialAllocation",
            label: "Allow partial allocation",
            value: ruleProjection.assignmentEnumId === "ORA_MULTI" ? "Enabled" : "Disabled",
            dirty: changedTargets.has("selectedRule.partialAllocation")
          },
          {
            target: "selectedRule.partialGroupItemsAllocation",
            label: "Partially allocate grouped items",
            value: splitCondition?.fieldValue === "Y" || splitCondition?.fieldValue === true ? "Enabled" : "Disabled",
            dirty: changedTargets.has("selectedRule.partialGroupItemsAllocation")
          }
        ]
      };
    }

    if (card.kind === "unavailable" && ruleProjection) {
      return { ...card, items: proposalUnavailableItems(ruleProjection.actions || {}, changedTargets) };
    }

    if (card.kind !== "filters" && card.kind !== "sort") return card;

    const options = card.kind === "filters"
      ? isRuleCard ? ruleProjection?.inventoryFilters?.ENTCT_FILTER || {} : orderRoutingFilterOptions.value
      : isRuleCard ? ruleProjection?.inventoryFilters?.ENTCT_SORT_BY || {} : orderRoutingSortOptions.value;
    const enumerations = card.kind === "filters"
      ? isRuleCard ? conditionFilterEnums : ruleEnums
      : isRuleCard ? conditionSortEnums : ruleEnums;
    const targetPrefix = card.kind === "filters"
      ? isRuleCard ? "selectedRule.inventoryFilters" : "route.orderFilters"
      : isRuleCard ? "selectedRule.inventorySorts" : "route.orderSorts";
    const parentEnumId = card.kind === "filters"
      ? isRuleCard ? "INV_FILTER_PRM_TYPE" : "ORD_FILTER_PRM_TYPE"
      : isRuleCard ? "INV_SORT_PARAM_TYPE" : "ORD_SORT_PARAM_TYPE";
    const items = routingSectionItems(
      options,
      enumerations,
      parentEnumId,
      targetPrefix,
      card.kind,
      (_code, parameter) => changedTargets.has(`${targetPrefix}.${parameter}`)
        || (parameter === "PROXIMITY" && changedTargets.has(`${targetPrefix}.MEASUREMENT_SYSTEM`))
    ).filter((item) => !isRuleCard || (
      !item.target.endsWith(".SPLIT_ITEM_GROUP")
      && !item.target.endsWith(".MEASUREMENT_SYSTEM")
    ));

    // A removal no longer exists in the current card options, but it still needs a visible changed
    // row in the proposal card so the user can see what disappeared.
    card.items.forEach((item) => {
      if (!items.some((candidate) => candidate.target === item.target)) {
        if (item.target.endsWith(".MEASUREMENT_SYSTEM")) return;
        items.push(item);
      }
    });
    return { ...card, items };
  });
}

// Throw away the working copy's uncommitted edits and re-bind the editor to the server-pristine
// baseline. Exposed so the host header's Discard control can trigger it. Live mode only.
async function discardChanges(options: { navigate?: boolean } = {}) {
  if (isSandbox.value) return false;
  const navigate = options.navigate !== false;
  const wasNew = Boolean(group.value?.isNew);
  // Do not clear any local/proposal state unless the store proves that a compatible baseline exists.
  if (!routingStore.discardChanges()) return false;
  proposalSnapshot.value = null;
  if (wasNew) {
    group.value = {};
    groupName.value = "";
    description.value = "";
    clearEditorSelection();
    hasUnsavedChanges.value = false;
    emit("dirtyChange", false);
    if (navigate) {
      await nextTick();
      await router.replace("/order-routing");
    }
    return true;
  }
  // Re-bind the editor's local refs from the restored group WITHOUT re-fetching: the reference
  // data, group history and schedule were already loaded on mount and don't change on a discard,
  // and the baseline is already in memory. The only wait is for local queued control updates; no
  // backend request is made by Discard.
  discardRebindInProgress = true;
  try {
    await settleRoutingEditorDiscard(
      () => {
        if (!Object.keys(currentRoutingGroup.value).length) return;
        const prevRoutingId = activeRoutingId.value;
        group.value = currentRoutingGroup.value;
        groupName.value = group.value.groupName || "";
        description.value = group.value.description || "";
        job.value = routingGroupScheduleWorkingCopy(group.value);
        isGroupNameUpdating.value = false;
        isDescUpdating.value = false;
        isRouteNameUpdating.value = false;
        isRuleNameUpdating.value = false;
        const routings = group.value.routings || [];
        // Keep the user on the routing they were editing if it still exists; else fall back to the first.
        const target = routings.find((r: any) => r.orderRoutingId === prevRoutingId) || routings[0];
        if (target) selectRouting(target, false);
        else clearEditorSelection();
      },
      () => {
        hasUnsavedChanges.value = false;
        // A queued input/select event may have mirrored true back into the persisted store after
        // discardChanges restored the baseline. Publish the clean commit again after rebind settles.
        if (String(routingStore.currentGroup?.routingGroupId || "") === String(routingGroupId.value || "")) {
          routingStore.setHasUnsavedChanges(false);
        }
      },
      async () => {
        await nextTick();
        await nextTick();
      }
    );
  } finally {
    discardRebindInProgress = false;
  }
  return true;
}

defineExpose({
  prepareDraftProposal,
  previewDraftProposal,
  acceptDraftProposal,
  rejectDraftProposal,
  getProposalContextCards,
  save,
  discardChanges,
  flushEditorDraft,
  activateForVisibleGroup,
  activateWorkingFlushHook,
  deactivateWorkingFlushHook
});

function isFacilityGroupSelected(facilityGroupId: string | number, type: string) {
  const facilityGroupIncluded = getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, 'FACILITY_GROUP')?.fieldValue;
  const facilityGroupExcluded = getFilterValue(inventoryRuleFilterOptions.value, conditionFilterEnums, 'FACILITY_GROUP_EXCLUDED')?.fieldValue;

  if (type === 'included') {
    return String(facilityGroupExcluded || "") === String(facilityGroupId);
  } else {
    return String(facilityGroupIncluded || "") === String(facilityGroupId);
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

function getPromiseDateValue(type = "included") {
  const key = type === "excluded" ? "PROMISE_DATE_EXCLUDED" : "PROMISE_DATE";
  const promiseDateFilter = getFilterValue(orderRoutingFilterOptions.value, ruleEnums, key)
  return promiseDateFilter?.fieldValue || '-'
}

// Product categories for the PROD_CATEGORY(/_EXCLUDED) order filter select.
// Sandbox categories intentionally remain empty until a simulation-scoped catalog source exists.
const catalogCategories = computed((): any => editorReferenceMaps.value.catalogCategories)
const sandboxReferenceLoading = computed(() => isSandbox.value
  && (simReferences.loadState === "idle" || simReferences.loadState === "loading"));
const sandboxReferenceError = computed(() => isSandbox.value && simReferences.loadState === "error");

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
const liveActionsBlocked = computed(() => Boolean(group.value?.isNew || hasUnsavedChanges.value));
function guardLiveGroupAction(): boolean {
  if (!liveActionsBlocked.value) return false;
  const message = group.value?.isNew
    ? "Save this routing group before using quick actions."
    : "Save or discard changes before using quick actions.";
  commonUtil.showToast(translate(message));
  return true;
}
// Make `hasUnsavedChanges` reflect EVERY kind of live edit so it's the one display signal (header
// Save/Discard + test-drive disable). Editor-local edits (filters/sorts/actions) already set it
// directly; store-mutation edits (status/add/clone/rename/name) set currentGroup.hasUnsavedChanges,
// which we mirror in here. And mirror it back onto the store working copy so the no-clobber guard in
// clearCurrentGroup also covers editor-local edits.
watch(() => routingStore.getCurrentRoutingGroup?.hasUnsavedChanges, (v) => {
  if (!isSandbox.value
    && isVisibleEditor
    && String(routingStore.getCurrentRoutingGroup?.routingGroupId || "") === String(routingGroupId.value || "")
    && v) hasUnsavedChanges.value = true;
})
watch(hasUnsavedChanges, (v) => {
  if ((discardRebindInProgress || authoritativeSandboxRebindInProgress) && v) {
    hasUnsavedChanges.value = false;
    return;
  }
  if (!isSandbox.value
    && isVisibleEditor
    && v
    && String(routingStore.getCurrentRoutingGroup?.routingGroupId || "") === String(routingGroupId.value || "")) {
    routingStore.setHasUnsavedChanges(true);
  }
})
watch(hasUnsavedChanges, (v) => { emit("dirtyChange", v) }, { immediate: true })
const ruleNameRef = ref()
let unregisterWorkingFlushHook: (() => void) | undefined;
let isVisibleEditor = false;
let visibleActivationVersion = 0;
let discardRebindInProgress = false;
let authoritativeSandboxRebindInProgress = false;

// Ionic keeps this editor mounted across group-param changes and page hides, so a slow schedule or
// status response started on group A can resolve while the instance already shows group B. Every
// such continuation must prove it still belongs to the group (and visibility) that started it
// before publishing UI state or adopting anything into the store baseline.
const editorInstanceIdentity = {};
const groupOperationGuard = new RoutingPageOperationGuard();
function liveGroupOperationIdentity(): RoutingPageOperationIdentity {
  return {
    routingGroupId: String(routingGroupId.value || ""),
    variationId: "",
    editor: editorInstanceIdentity
  };
}

function activateWorkingFlushHook() {
  unregisterWorkingFlushHook?.();
  unregisterWorkingFlushHook = registerWorkingFlushHook(flushEditorDraft);
}

function deactivateWorkingFlushHook(flush = true) {
  if (flush && isVisibleEditor) flushEditorDraft();
  isVisibleEditor = false;
  visibleActivationVersion += 1;
  // Same-group continuations must also die when the page merely goes hidden — a later re-entry is
  // a fresh activation, not a continuation of whatever was in flight when the user left.
  groupOperationGuard.invalidate();
  unregisterWorkingFlushHook?.();
  unregisterWorkingFlushHook = undefined;
}

/**
 * Claim the singleton flush hook and rebind data only when the owning Ionic page is visible.
 * Ionic caches routed pages, so child mount/unmount is not a reliable ownership signal.
 */
async function activateForVisibleGroup(): Promise<void> {
  const activationVersion = ++visibleActivationVersion;
  isVisibleEditor = true;
  activateWorkingFlushHook();

  if (isSandbox.value) {
    isLoadingGroup.value = true;
    const requestedGroupId = String(routingGroupId.value || "");
    try {
      if (requestedGroupId && sim.routingGroupId !== requestedGroupId) {
        await sim.loadGroup(requestedGroupId);
      }
      if (!isVisibleEditor || activationVersion !== visibleActivationVersion) return;
      await initializeFromWorking();
    } finally {
      if (isVisibleEditor && activationVersion === visibleActivationVersion) isLoadingGroup.value = false;
    }
    return;
  }

  const requestedGroupId = String(routingGroupId.value || "");
  const cachedDraft = requestedGroupId
    && String(group.value?.routingGroupId || "") === requestedGroupId
    && hasUnsavedChanges.value
      ? cloneSnapshotValue(group.value)
      : null;
  await fetchRoutingGroupInformation(activationVersion, cachedDraft);
  if (isVisibleEditor && activationVersion === visibleActivationVersion) {
    hasUnsavedChanges.value = !!routingStore.getCurrentRoutingGroup?.hasUnsavedChanges;
  }
}

onMounted(() => {
  window.addEventListener('pointerup', resetReordering);
  window.addEventListener('touchend', resetReordering);
  window.addEventListener('mouseup', resetReordering);
  // Hook ownership belongs to the visible Ionic page. Routed pages are cached, so claiming the
  // singleton hook merely because this child mounted would let a hidden editor steal it from the
  // page the user can actually see. RoutingDetailCanvas activates/deactivates the exposed hook from
  // its view-enter/view-leave lifecycle.
});

onBeforeUnmount(() => {
  if (isVisibleEditor) flushEditorDraft();
  // If a Circuit proposal is still undecided when this editor unmounts (the detail page is keyed by
  // activeVariationId, so opening a variation remounts it), auto-reject it: the snapshot lives only on
  // this instance, so leaving it applied would strand the un-accepted change in the working copy with
  // no way back. restoreProposalSnapshot reverts the matching live or simulation working copy.
  if (proposalSnapshot.value) restoreProposalSnapshot();
});

onUnmounted(() => {
  window.removeEventListener('pointerup', resetReordering);
  window.removeEventListener('touchend', resetReordering);
  window.removeEventListener('mouseup', resetReordering);
  deactivateWorkingFlushHook(false);
});

function resetReordering() {
  isReordering.value = false;
}

// Live: re-load from backend when the routing group id changes.
watch(routingGroupId, async () => {
  if (!isSandbox.value && isVisibleEditor) {
    flushEditorDraft();
    await activateForVisibleGroup();
  }
});

// Sandbox: re-bind when the store swaps the working copy (load variation / reset to baseline).
watch(() => sim.working, async () => {
  if (isSandbox.value && isVisibleEditor) {
    // Store operations flush the visible draft before replacing `working`. The replacement is the
    // new authoritative baseline (load/reset/successful save), so flushing the stale projection
    // again would overwrite it and incorrectly leave the editor dirty after a successful save.
    authoritativeSandboxRebindInProgress = true;
    try {
      await initializeFromWorking();
      hasUnsavedChanges.value = false;
      await nextTick();
      hasUnsavedChanges.value = false;
    } finally {
      authoritativeSandboxRebindInProgress = false;
    }
  }
});

async function fetchRoutingGroupInformation(activationVersion = visibleActivationVersion, cachedDraft: any = null) {
  const requestedGroupId = String(routingGroupId.value || "");
  if (!requestedGroupId) {
    group.value = {};
    job.value = {};
    clearEditorSelection();
    isLoadingGroup.value = false;
    return;
  }

  // Local loading state (not the global App.vue singleton loader): this fetch runs on mount
  // and can overlap other flows on the detail page (e.g. the simulation store loading), and the
  // shared singleton loader can't safely handle concurrent callers. A local spinner is isolated.
  isLoadingGroup.value = true
  const previousRoutingId = activeRoutingId.value;
  try {
    await routingStore.fetchCurrentRoutingGroup(requestedGroupId);
    if (!isVisibleEditor
      || activationVersion !== visibleActivationVersion
      || String(routingGroupId.value || "") !== requestedGroupId) return;

    if (cachedDraft) {
      const serverGroup = cloneSnapshotValue(currentRoutingGroup.value);
      await routingStore.setCurrentGroup({
        ...serverGroup,
        ...cachedDraft,
        schedule: serverGroup.schedule,
        isRoutingGroupDetailLoaded: true
      }, true);
    }
    if(Object.keys(currentRoutingGroup.value).length) {
      group.value = currentRoutingGroup.value
      groupName.value = group.value.groupName || ""
      description.value = group.value.description || ""
      job.value = routingGroupScheduleWorkingCopy(group.value)

      await Promise.all([
        fetchGroupHistory(),
        fetchGroupSchedule(),
        product.fetchRoutingReferenceData({ productStoreId: group.value.productStoreId }),
        // Direct detail entry does not pass through the list page, so the editor owns loading the
        // routing enum families used by its filter/sort option modals.
        utilStore.fetchRoutingEditorEnums(),
        utilStore.fetchStatusInformation()
      ])
      // Categories back the PROD_CATEGORY(/_EXCLUDED) filter select options; they aren't
      // needed for initial paint, so load them without blocking the group load.
      utilStore.fetchCategories()

      if (!isVisibleEditor
        || activationVersion !== visibleActivationVersion
        || String(routingGroupId.value || "") !== requestedGroupId) return;

      const target = group.value.routings?.find((routing: any) => routingWorkingKey(routing) === previousRoutingId)
        || group.value.routings?.[0];
      if (target) selectRouting(target, false);
      else clearEditorSelection();
    }
  } catch(err) {
    logger.error(err);
  } finally {
    if (activationVersion === visibleActivationVersion) isLoadingGroup.value = false
  }
}

async function fetchRoutingsInformation() {
  // Details are now fetched as part of fetchCurrentRoutingGroup (raw data)
  return;
}

function stageNewRouting(routingName: string) {
  flushEditorDraft();
  const routings = group.value.routings || [];
  const tail = routings[routings.length - 1];
  const orderRoutingId = createClientUuid();
  const routing = {
    _tempId: `temp-routing-${++tempIdCounter}`,
    orderRoutingId,
    routingGroupId: group.value.routingGroupId,
    statusId: "ROUTING_DRAFT",
    routingName: routingName.trim(),
    sequenceNum: tail?.sequenceNum >= 0 ? Number(tail.sequenceNum) + 5 : 0,
    description: "",
    createdDate: DateTime.now().toMillis(),
    orderFilters: [],
    rules: []
  };
  group.value.routings = commonUtil.sortSequence([...routings, routing]);
  hasUnsavedChanges.value = true;
  return orderRoutingId;
}

async function createNewRouting() {
  if (isSandbox.value) return; // adding a routing to a variation isn't supported (matches the sim flow)
  if (!routingGroupId.value) return;
  const alert = await alertController.create({
    header: translate("New routing"),
    inputs: [{ name: "routingName", placeholder: translate("routing name") }],
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      {
        text: translate("Save"),
        handler: (data: any) => {
          if (!data.routingName?.trim()) {
            commonUtil.showToast(translate("Please enter a valid name"));
            return false;
          }
        }
      }
    ]
  });
  alert.onDidDismiss().then((result: any) => {
    if (result.role) return;
    const routingName = result.data?.values?.routingName?.trim();
    if (!routingName) return;
    const orderRoutingId = stageNewRouting(routingName);
    const created = group.value.routings.find((routing: any) => routingWorkingKey(routing) === orderRoutingId);
    if (created) selectRouting(created, false);
  });
  return alert.present();
}

function clearEditorSelection() {
  activeRoutingId.value = "";
  activeRuleId.value = "";
  activeRouting.value = null;
  initialActiveRouting.value = null;
  activeRule.value = null;
  ruleName.value = "";
  routeName.value = "";
  orderRoutingFilterOptions.value = {};
  orderRoutingSortOptions.value = {};
  inventoryRules.value = [];
  rulesForReorder.value = [];
  inventoryRuleFilterOptions.value = {};
  inventoryRuleSortOptions.value = {};
  inventoryRuleActions.value = {};
  rulesInformation.value = {};
  initialRulesInformation.value = {};
  ruleActionType.value = "";
}

const selectRouting = (routing: any, flushCurrent = true) => {
  if (!routing) {
    clearEditorSelection();
    return;
  }
  if (flushCurrent) flushEditorDraft();

  const key = routingWorkingKey(routing);
  const rawRouting = (group.value.routings || []).find((candidate: any) => routingWorkingKey(candidate) === key) || routing;
  activeRoutingId.value = key;
  // The editor always works on a projection. The raw group is changed only by flushEditorDraft.
  activeRouting.value = cloneSnapshotValue(rawRouting);
  initialActiveRouting.value = cloneSnapshotValue(rawRouting);
  activeRuleId.value = "";
  activeRule.value = null;
  ruleName.value = "";
  rulesInformation.value = {};
  initialRulesInformation.value = {};

  if (!isSandbox.value && rawRouting.orderRoutingId) routingStore.setCurrentOrderRouting(rawRouting.orderRoutingId);

  routeName.value = rawRouting.routingName || "";
  isRouteNameUpdating.value = false;
  initializeOrderRoutingOptions();

  inventoryRules.value = cloneSnapshotValue(rawRouting.rules || []);
  initializeInventoryRules(true);

  if (rulesForReorder.value.length) selectRule(rulesForReorder.value[0], false);
};

const selectRule = (rule: any, flushCurrent = true) => {
  if (flushCurrent) syncActiveRuleDraft();
  const key = ruleWorkingKey(rule);
  if (!key) {
    activeRuleId.value = "";
    activeRule.value = null;
    ruleName.value = "";
    inventoryRuleFilterOptions.value = {};
    inventoryRuleSortOptions.value = {};
    inventoryRuleActions.value = {};
    ruleActionType.value = "";
    return;
  }

  const rawRule = inventoryRules.value.find((candidate: any) => ruleWorkingKey(candidate) === key) || rule;
  const projection = rulesInformation.value[key]
    ? cloneSnapshotValue(rulesInformation.value[key])
    : projectRuleForEditor(rawRule);
  activeRuleId.value = key;
  activeRule.value = projection;
  ruleName.value = String(projection.ruleName || "");
  rulesInformation.value[key] = cloneSnapshotValue(projection);
  if (!initialRulesInformation.value[key]) initialRulesInformation.value[key] = cloneSnapshotValue(projection);
  initializeInventoryRule(projection);
};

function ruleKey(rule: any) {
  return ruleWorkingKey(rule);
}

function isRuleDirty(rule: any) {
  const key = ruleWorkingKey(rule);
  if (!key) return false;
  const rawRule = inventoryRules.value.find((candidate: any) => ruleWorkingKey(candidate) === key) || rule;
  const currentRule = key === activeRuleId.value && activeRule.value
    ? {
        ...cloneSnapshotValue(activeRule.value),
        inventoryFilters: {
          ENTCT_FILTER: cloneSnapshotValue(inventoryRuleFilterOptions.value),
          ENTCT_SORT_BY: cloneSnapshotValue(inventoryRuleSortOptions.value)
        },
        actions: cloneSnapshotValue(inventoryRuleActions.value)
      }
    : rulesInformation.value[key] || projectRuleForEditor(rawRule);
  return isRoutingRuleDraftDirty(currentRule, initialRulesInformation.value[key]);
}

function comparableCondition(condition: any) {
  if (!condition) return null;
  return {
    fieldName: condition.fieldName || "",
    fieldValue: condition.fieldValue ?? null,
    operator: condition.operator || "",
    sequenceNum: Number(condition.sequenceNum || 0)
  };
}

function conditionChanged(current: any, baseline: any) {
  return JSON.stringify(comparableCondition(current)) !== JSON.stringify(comparableCondition(baseline));
}

function initialOrderConditionMap(conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY") {
  return (initialActiveRouting.value?.orderFilters || [])
    .filter((condition: any) => condition.conditionTypeEnumId === conditionTypeEnumId)
    .reduce((result: Record<string, any>, condition: any) => {
      result[condition.fieldName] = condition;
      return result;
    }, {});
}

function currentOrderConditionMap(conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY") {
  return conditionTypeEnumId === "ENTCT_FILTER"
    ? orderRoutingFilterOptions.value
    : orderRoutingSortOptions.value;
}

function currentRuleConditionMap(conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY") {
  return conditionTypeEnumId === "ENTCT_FILTER"
    ? inventoryRuleFilterOptions.value
    : inventoryRuleSortOptions.value;
}

function initialRuleConditionMap(conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY") {
  return initialRulesInformation.value[activeRuleId.value]?.inventoryFilters?.[conditionTypeEnumId] || {};
}

function isOrderConditionCodeDirty(conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY", code: string) {
  return conditionChanged(
    currentOrderConditionMap(conditionTypeEnumId)?.[code],
    initialOrderConditionMap(conditionTypeEnumId)?.[code]
  );
}

function isOrderConditionDirty(conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY", parameter: string) {
  const code = ruleEnums[parameter]?.code;
  return Boolean(code && isOrderConditionCodeDirty(conditionTypeEnumId, code));
}

function isOrderConditionCardDirty(conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY") {
  const current = currentOrderConditionMap(conditionTypeEnumId);
  const baseline = initialOrderConditionMap(conditionTypeEnumId);
  return [...new Set([...Object.keys(current || {}), ...Object.keys(baseline || {})])]
    .some((code) => conditionChanged(current?.[code], baseline?.[code]));
}

function isRuleConditionCodeDirty(conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY", code: string) {
  return conditionChanged(
    currentRuleConditionMap(conditionTypeEnumId)?.[code],
    initialRuleConditionMap(conditionTypeEnumId)?.[code]
  );
}

function isRuleConditionDirty(conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY", parameter: string) {
  const enumerations = conditionTypeEnumId === "ENTCT_FILTER" ? conditionFilterEnums : conditionSortEnums;
  const code = enumerations[parameter]?.code;
  return Boolean(code && isRuleConditionCodeDirty(conditionTypeEnumId, code));
}

function isRuleConditionCardDirty(conditionTypeEnumId: "ENTCT_FILTER" | "ENTCT_SORT_BY") {
  const current = currentRuleConditionMap(conditionTypeEnumId);
  const baseline = initialRuleConditionMap(conditionTypeEnumId);
  return [...new Set([...Object.keys(current || {}), ...Object.keys(baseline || {})])]
    .some((code) => conditionChanged(current?.[code], baseline?.[code]));
}

function isPartialAvailabilityDirty() {
  const baseline = initialRulesInformation.value[activeRuleId.value];
  return Boolean(baseline) && (
    String(activeRule.value?.assignmentEnumId || "") !== String(baseline.assignmentEnumId || "")
    || isRuleConditionDirty("ENTCT_FILTER", "SPLIT_ITEM_GROUP")
  );
}

function isPartialAllocationDirty() {
  const baseline = initialRulesInformation.value[activeRuleId.value];
  return Boolean(baseline)
    && String(activeRule.value?.assignmentEnumId || "") !== String(baseline.assignmentEnumId || "");
}

function isPartialGroupItemsAllocationDirty() {
  return isRuleConditionDirty("ENTCT_FILTER", "SPLIT_ITEM_GROUP");
}

function routingSectionItems(
  options: Record<string, any>,
  enumerations: Record<string, any>,
  parentEnumId: string,
  targetPrefix: string,
  kind: "filters" | "sort",
  isDirty: (code: string, parameter: string) => boolean
) {
  return Object.entries(options || {}).map(([code, condition]) => {
    const parameter = enumParameterForCode(enumerations, code);
    return {
      target: `${targetPrefix}.${parameter}`,
      label: routingConfigTargetLabel(`${targetPrefix}.${parameter}`) || getLabel(parentEnumId, code) || parameter,
      value: kind === "sort" ? "" : conditionContextValue(options, enumerations, parameter, condition),
      dirty: isDirty(code, parameter)
    };
  });
}

function actionValue(actionId: string) {
  return inventoryRuleActions.value[actionEnums[actionId]?.id]?.actionValue;
}

function initialActionValue(actionId: string) {
  return initialRulesInformation.value[activeRuleId.value]?.actions?.[actionEnums[actionId]?.id]?.actionValue;
}

function actionValueDirty(actionId: string) {
  return String(actionValue(actionId) ?? "") !== String(initialActionValue(actionId) ?? "");
}

function unavailableSectionItems() {
  const moveToQueue = ruleActionType.value === actionEnums.MOVE_TO_QUEUE?.id;
  const clearDays = JSON.parse(actionValue("RM_AUTO_CANCEL_DATE") || false);
  return [
    {
      target: "selectedRule.unavailableItemsAction",
      label: "Move items to",
      value: moveToQueue ? "Queue" : "Next rule",
      dirty: actionValueDirty("NEXT_RULE") || actionValueDirty("MOVE_TO_QUEUE")
    },
    ...(moveToQueue ? [{
      target: "selectedRule.unavailableItemsQueueId",
      label: "Queue",
      value: facilities.value[actionValue("MOVE_TO_QUEUE")]?.facilityName || String(actionValue("MOVE_TO_QUEUE") || ""),
      dirty: actionValueDirty("MOVE_TO_QUEUE")
    }] : []),
    {
      target: "selectedRule.clearAutoCancelDays",
      label: "Clear auto cancel days",
      value: clearDays ? "Enabled" : "Disabled",
      dirty: actionValueDirty("RM_AUTO_CANCEL_DATE")
    },
    ...(!clearDays ? [{
      target: "selectedRule.autoCancelDays",
      label: "Auto cancel days",
      value: String(actionValue("AUTO_CANCEL_DAYS") || "select days"),
      dirty: actionValueDirty("AUTO_CANCEL_DAYS")
    }] : [])
  ];
}

function comparableActions(actions: Record<string, any> = {}) {
  return Object.keys(actions)
    .sort()
    .reduce((result: Record<string, any>, key) => {
      const action = actions[key];
      result[key] = {
        actionTypeEnumId: action?.actionTypeEnumId || key,
        actionValue: action?.actionValue ?? null
      };
      return result;
    }, {});
}

function isUnavailableItemsDirty() {
  const baseline = initialRulesInformation.value[activeRuleId.value]?.actions || {};
  return JSON.stringify(comparableActions(inventoryRuleActions.value))
    !== JSON.stringify(comparableActions(baseline));
}

function guardLockedInteraction(event: Event) {
  if (!props.interactionLocked) return;
  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest("ion-button, button, ion-input, ion-textarea, ion-select, ion-toggle, ion-chip, ion-reorder, a, .pointer, .rule-item")) return;
  event.preventDefault();
  event.stopPropagation();
}

function normalizeLiveDraftRuleIds() {
  if (isSandbox.value) return;
  inventoryRules.value.forEach((rule: any) => {
    const previousId = rule.routingRuleId;
    if (!String(previousId || "").match(/^(new|draft):/)) return;
    const routingRuleId = createClientUuid();
    rule._tempId = rule._tempId || previousId;
    rule.routingRuleId = routingRuleId;
    rule.inventoryFilters = (rule.inventoryFilters || []).map((filter: any) => ({ ...filter, routingRuleId }));
    rule.actions = (rule.actions || []).map((action: any) => ({ ...action, routingRuleId }));

    const projection = rulesInformation.value[previousId];
    if (projection) {
      delete rulesInformation.value[previousId];
      const nextProjection = cloneSnapshotValue(projection);
      nextProjection.routingRuleId = routingRuleId;
      Object.values(nextProjection.inventoryFilters?.ENTCT_FILTER || {}).forEach((filter: any) => { filter.routingRuleId = routingRuleId; });
      Object.values(nextProjection.inventoryFilters?.ENTCT_SORT_BY || {}).forEach((filter: any) => { filter.routingRuleId = routingRuleId; });
      Object.values(nextProjection.actions || {}).forEach((action: any) => { action.routingRuleId = routingRuleId; });
      rulesInformation.value[routingRuleId] = nextProjection;
    }
    if (initialRulesInformation.value[previousId]) {
      initialRulesInformation.value[routingRuleId] = initialRulesInformation.value[previousId];
      delete initialRulesInformation.value[previousId];
    }
    rulesForReorder.value.forEach((listedRule: any) => {
      if (listedRule.routingRuleId === previousId) listedRule.routingRuleId = routingRuleId;
    });
    if (activeRuleId.value === previousId) {
      activeRuleId.value = routingRuleId;
      if (activeRule.value) activeRule.value.routingRuleId = routingRuleId;
      Object.values(inventoryRuleFilterOptions.value || {}).forEach((filter: any) => { filter.routingRuleId = routingRuleId; });
      Object.values(inventoryRuleSortOptions.value || {}).forEach((filter: any) => { filter.routingRuleId = routingRuleId; });
      Object.values(inventoryRuleActions.value || {}).forEach((action: any) => { action.routingRuleId = routingRuleId; });
    }
  });
}

function syncPendingInlineEdits() {
  const changed = applyPendingRoutingInlineEdits({
    group: group.value,
    activeRouting: activeRouting.value,
    activeRule: activeRule.value,
    inventoryRules: inventoryRules.value,
    editing: {
      groupName: !isSandbox.value && isGroupNameUpdating.value,
      description: !isSandbox.value && isDescUpdating.value,
      routeName: isRouteNameUpdating.value,
      ruleName: isRuleNameUpdating.value
    },
    values: {
      groupName: groupName.value,
      description: description.value,
      routeName: routeName.value,
      ruleName: ruleName.value
    }
  });

  if (changed) {
    groupName.value = String(group.value.groupName || "");
    description.value = String(group.value.description || "");
    routeName.value = String(activeRouting.value?.routingName || "");
    hasUnsavedChanges.value = true;
  }
}

// Serialize the currently visible projections into the one raw, flat-array working copy used by
// both live editing and simulation variations. This is intentionally synchronous so navigation,
// remount and beforeunload callers cannot race it.
function flushEditorDraft(): void {
  if (!group.value?.routingGroupId) return;
  syncPendingInlineEdits();
  normalizeLiveDraftRuleIds();
  syncActiveRuleDraft();
  syncCachedRuleDrafts();
  if (!activeRouting.value || !activeRoutingId.value) return;

  const serialized = serializeRoutingWorkingCopy(
    activeRouting.value,
    orderRoutingFilterOptions.value,
    orderRoutingSortOptions.value,
    inventoryRules.value
  );
  group.value.routings = replaceWorkingEntry(
    group.value.routings || [],
    serialized,
    routingWorkingKey
  );
  activeRouting.value = cloneSnapshotValue(serialized);

  // Live groups normally share this reference already. If another local store action replaced the
  // top-level object, restore the authoritative working-copy reference without changing baseline.
  if (!isSandbox.value && routingStore.currentGroup !== group.value) {
    routingStore.currentGroup = group.value;
  }
}

// Sandbox load: bind the editor to the in-memory simulation working copy (no backend fetch).
// group.value is pointed AT sim.working by reference so edits propagate into the store copy.
async function initializeFromWorking() {
  if (!sim.working || !sim.working.routingGroupId) {
    group.value = {};
    clearEditorSelection();
    await simReferences.fetchReferenceData({ productStoreId: "" });
    return;
  }
  const previousRoutingId = activeRoutingId.value;
  group.value = sim.working;
  groupName.value = group.value.groupName || "";
  description.value = group.value.description || "";
  // Simulation reference data is loaded exclusively from the sim instance. Catalog categories and
  // status descriptions have no sim-scoped source yet and remain explicit UI blockers above.
  await simReferences.fetchReferenceData({ productStoreId: String(group.value.productStoreId || "") });
  const target = group.value.routings?.find((routing: any) => routingWorkingKey(routing) === previousRoutingId)
    || group.value.routings?.[0];
  if (target) selectRouting(target, false);
  else clearEditorSelection();
}

function initializeInventoryRule(rule: any) {
  const projection = projectRuleForEditor(rule);
  inventoryRuleFilterOptions.value = cloneSnapshotValue(projection.inventoryFilters.ENTCT_FILTER || {});
  inventoryRuleSortOptions.value = cloneSnapshotValue(projection.inventoryFilters.ENTCT_SORT_BY || {});
  inventoryRuleActions.value = cloneSnapshotValue(projection.actions || {});

  const actionTypes = ["ORA_NEXT_RULE", "ORA_MV_TO_QUEUE"]
  ruleActionType.value = Object.keys(inventoryRuleActions.value).find((actionId: string) => {
    return actionTypes.includes(actionId)
  }) || ""
}

function initializeInventoryRules(captureBaseline = false) {
  rulesForReorder.value = commonUtil.sortSequence(JSON.parse(JSON.stringify(getActiveAndDraftOrderRules())))
  if (!captureBaseline) return;
  inventoryRules.value.forEach((rule: any) => {
    const key = ruleWorkingKey(rule);
    if (!key) return;
    const projection = projectRuleForEditor(rule);
    rulesInformation.value[key] = cloneSnapshotValue(projection);
    initialRulesInformation.value[key] = cloneSnapshotValue(projection);
  });
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

  return enumInfo?.description || routingEditorCodeLabel(code)
}

function getRuleIndex() {
  const total = rulesForReorder.value.length
  const currentRuleIndex: any = Object.keys(rulesForReorder.value).find((key: any) => ruleKey(rulesForReorder.value[key]) === ruleKey(activeRule.value))

  return `${+currentRuleIndex + 1}/${total}`
}

async function fetchGroupSchedule() {
  try {
    await routingStore.fetchCurrentGroupSchedule({ routingGroupId: routingGroupId.value || "", currentGroup: group.value });
    job.value = routingGroupScheduleWorkingCopy(group.value)
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
  if (groupName.value.trim() && groupName.value.trim() !== String(group.value.groupName || "").trim()) {
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
  if (payload.groupName !== undefined) group.value.groupName = payload.groupName;
  if (payload.description !== undefined) group.value.description = payload.description;
  hasUnsavedChanges.value = true;
  return payload.routingGroupId || group.value.routingGroupId || "working-copy";
}

async function cloneGroup() {
  if (isSandbox.value) return // group-level live action; not applicable to a sandboxed variation
  if (guardLiveGroupAction()) return;
  flushEditorDraft();
  try {
    const response = await routingStore.cloneGroup({
      routingGroupId: group.value.routingGroupId,
      newGroupName: `${group.value.groupName || "Routing group"} copy`
    });
    const clonedGroupId = response?.data?.routingGroupId;
    if (!clonedGroupId) throw new Error("Clone did not return a routing group id");
    commonUtil.showToast(translate("Routing group cloned"));
    await router.push(canonicalRoutingEditorRoute(clonedGroupId));
  } catch (err) {
    logger.error(err);
    commonUtil.showToast(translate("Failed to clone routing group"));
  }
}

async function openScheduleModal() {
  if (isSandbox.value || guardLiveGroupAction()) return;
  const scheduleModal = await modalController.create({
    component: ScheduleModal,
    componentProps: { cronExpression: job.value.cronExpression }
  })

  scheduleModal.onDidDismiss().then(async (result: any) => {
    if (result?.data?.expression) {
      await saveSchedule(result.data.expression)
    }
  })

  scheduleModal.present();
}

async function saveSchedule(nextCronExpression = job.value.cronExpression) {
  if (isSandbox.value) return // scheduling is a live group action; not applicable to a variation
  if (guardLiveGroupAction()) return;
  if (!nextCronExpression) {
    commonUtil.showToast(translate("Please select a scheduling for job"))
    return false;
  }

  const previousJob = cloneSnapshotValue(job.value || {});
  const operationToken = groupOperationGuard.begin(liveGroupOperationIdentity());
  const operationGroupId = operationToken.routingGroupId;
  const payload = {
    ...previousJob,
    routingGroupId: operationGroupId,
    paused: previousJob.paused || 'N',
    cronExpression: nextCronExpression
  }

  try {
    const resp = await routingStore.scheduleBrokering(payload)
    // The backend accepted (or rejected) group A's schedule; if this cached instance has moved on,
    // publishing here would land on whatever group is visible now. Drop the continuation.
    if (!groupOperationGuard.isCurrent(operationToken, liveGroupOperationIdentity())) return false;
    if (commonUtil.hasError(resp)) throw resp?.data || new Error("Schedule update failed");

    // Publish the requested value only after the backend accepted it. A best-effort readback then
    // replaces it with the canonical schedule when that endpoint is available.
    job.value = {
      ...previousJob,
      ...(resp?.data?.schedule || {}),
      cronExpression: resp?.data?.schedule?.cronExpression || nextCronExpression
    };
    // The backend accepted this schedule, so it is committed state: adopt it into the store
    // baseline now (Discard must not resurrect the old schedule), then let the readback refine it.
    routingStore.adoptCommittedSchedule(operationGroupId, job.value);
    commonUtil.showToast(translate("Job updated"))
    await fetchGroupSchedule()
    return true;
  } catch (err) {
    if (groupOperationGuard.isCurrent(operationToken, liveGroupOperationIdentity())) {
      job.value = previousJob;
      commonUtil.showToast(translate("Failed to update job"))
    }
    logger.error(err)
    return false;
  }
}

async function updateGroupStatus(event: CustomEvent) {
  if (isSandbox.value) return // live group status; not applicable to a variation
  if (guardLiveGroupAction()) return;
  const previousJob = cloneSnapshotValue(job.value || {});
  const nextPaused = event.detail.value;
  const operationToken = groupOperationGuard.begin(liveGroupOperationIdentity());
  const operationGroupId = operationToken.routingGroupId;

  const payload = {
    ...previousJob,
    routingGroupId: operationGroupId,
    paused: nextPaused,
    cronExpression: previousJob.cronExpression || "0 0 0 * * ?"
  }

  try {
    const resp = await routingStore.scheduleBrokering(payload)
    if (!groupOperationGuard.isCurrent(operationToken, liveGroupOperationIdentity())) return false;
    if (commonUtil.hasError(resp)) throw resp?.data || new Error("Group status update failed");

    job.value = {
      ...previousJob,
      ...(resp?.data?.schedule || {}),
      paused: resp?.data?.schedule?.paused || nextPaused,
      cronExpression: resp?.data?.schedule?.cronExpression || payload.cronExpression
    };
    routingStore.adoptCommittedSchedule(operationGroupId, job.value);
    commonUtil.showToast(translate("Group status updated"))
    await fetchGroupSchedule();
    return true;
  } catch (err) {
    // Keep the control aligned with backend truth when a resolved error response or network error
    // rejects the immediate action.
    if (groupOperationGuard.isCurrent(operationToken, liveGroupOperationIdentity())) {
      job.value = previousJob;
      commonUtil.showToast(translate("Failed to update group status"))
    }
    logger.error(err)
    return false;
  }
}

async function runNow() {
  if (isSandbox.value) return // live run; variations are run via the Variations rail
  if (guardLiveGroupAction()) return;
  const scheduleAlert = await alertController.create({
    header: translate("Run now"),
    message: translate("Running this schedule now will not replace this schedule. A copy of this schedule will be created and run immediately. You may not be able to reverse this action."),
    buttons: [
      { text: translate("Cancel"), role: "cancel" },
      {
        text: translate("Run now"),
        handler: async () => {
          if (guardLiveGroupAction()) return false;
          if (!job.value.jobName) {
            const payload = {
              routingGroupId: routingGroupId.value || "",
              paused: "Y",
            }
            try {
              const resp = await routingStore.scheduleBrokering(payload)
              if (commonUtil.hasError(resp) || !resp?.data?.jobName) {
                throw resp?.data || new Error("Schedule creation returned no job name");
              }
              job.value.jobName = resp.data.jobName
            } catch (err) {
              commonUtil.showToast(translate("Failed to schedule service"))
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
  syncActiveRuleDraft();
  inventoryRules.value.forEach((inventoryRule: any) => {
    if(ruleKey(inventoryRule) === routingRuleId) {
      inventoryRule.statusId = event.detail.value
    }
  })
  if (rulesInformation.value[routingRuleId]) rulesInformation.value[routingRuleId].statusId = event.detail.value;

  if (ruleKey(activeRule.value) === routingRuleId) activeRule.value.statusId = event.detail.value;

  if(event.detail.value === "RULE_ARCHIVED") {
    activeRule.value = null
  }

  hasUnsavedChanges.value = true
  initializeInventoryRules()
}

async function editRuleName() {
  isRuleNameUpdating.value = !isRuleNameUpdating.value;
  ruleName.value = String(activeRule.value?.ruleName || "");
  await nextTick()
  ruleNameRef.value.$el.setFocus();
}

async function updateRuleName(_routingRuleId: string) {
  const nextRuleName = ruleName.value.trim();
  if (activeRule.value && nextRuleName) {
    activeRule.value.ruleName = nextRuleName;
    ruleName.value = nextRuleName;
    hasUnsavedChanges.value = true;
    syncActiveRuleDraft();
    initializeInventoryRules();
  }
  isRuleNameUpdating.value = false
}

async function cloneRule(rule: any) {
  if (isSandbox.value) return // clone-rule is a live action; not supported for a sandboxed variation
  flushEditorDraft();
  const source = inventoryRules.value.find((candidate: any) => ruleKey(candidate) === ruleKey(rule));
  if (!source) return;
  const routingRuleId = createClientUuid();
  const cloned = cloneSnapshotValue(source);
  cloned._tempId = `temp-rule-${++tempIdCounter}`;
  cloned.routingRuleId = routingRuleId;
  cloned.orderRoutingId = activeRouting.value.orderRoutingId;
  cloned.ruleName = `${source.ruleName || "Rule"} copy`;
  const tail = inventoryRules.value[inventoryRules.value.length - 1];
  cloned.sequenceNum = tail?.sequenceNum >= 0 ? Number(tail.sequenceNum) + 5 : 0;
  cloned.inventoryFilters = (cloned.inventoryFilters || []).map((filter: any) => ({ ...filter, routingRuleId }));
  cloned.actions = (cloned.actions || []).map((action: any) => ({ ...action, routingRuleId }));
  inventoryRules.value.push(cloned);
  hasUnsavedChanges.value = true;
  initializeInventoryRules();
  const target = rulesForReorder.value.find((candidate: any) => ruleKey(candidate) === routingRuleId);
  if (target) selectRule(target, false);
  commonUtil.showToast(translate("Rule cloned successfully"));
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

function updateOperator(event: any, parameter = "BRK_SAFETY_STOCK") {
  const filters = JSON.parse(JSON.stringify(inventoryRuleFilterOptions.value))
  const filter = filters[conditionFilterEnums[parameter].code]

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
  if (!ruleKey(activeRule.value)) {
    commonUtil.showToast(translate("Please select a rule first"));
    return;
  }
  const modal = await modalController.create({
    component: AddInventoryFilterOptionsModal,
    componentProps: {
      ruleConditions: conditionTypeEnumId === "ENTCT_FILTER" ? inventoryRuleFilterOptions.value : inventoryRuleSortOptions.value,
      routingRuleId: activeRule.value.routingRuleId || activeRule.value._tempId,
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

  newRuleAlert.onDidDismiss().then((result: any) => {
    const ruleName = result.data?.values?.ruleName;
    if(!result.role && ruleName) {
      const sequenceNum = inventoryRules.value.length && inventoryRules.value[inventoryRules.value.length - 1].sequenceNum >= 0 ? inventoryRules.value[inventoryRules.value.length - 1].sequenceNum + 5 : 0

      syncActiveRuleDraft();
      const routingRuleId = isSandbox.value ? "" : createClientUuid();
      const newRule = {
        _tempId: `temp-rule-${++tempIdCounter}`,
        ...(routingRuleId ? { routingRuleId } : {}),
        orderRoutingId: activeRouting.value.orderRoutingId,
        ruleName,
        statusId: "RULE_DRAFT",
        sequenceNum,
        assignmentEnumId: "ORA_SINGLE",
        createdDate: DateTime.now().toMillis(),
        inventoryFilters: [],
        actions: [{
          actionTypeEnumId: "ORA_NEXT_RULE",
          actionValue: "",
          ...(routingRuleId ? { routingRuleId } : {})
        }]
      };
      inventoryRules.value.push(newRule);
      hasUnsavedChanges.value = true;
      initializeInventoryRules();
      const created = rulesForReorder.value.find((candidate: any) => ruleKey(candidate) === ruleKey(newRule));
      if (created) selectRule(created, false);
    }
  })

  await newRuleAlert.present();
}

async function openArchivedRuleModal() {
  flushEditorDraft();
  const archivedRuleModal = await modalController.create({
    component: ArchivedRuleModal,
    componentProps: {
      archivedRules: getArchivedOrderRules(),
      saveRules: (rules: any[]) => {
        const updated = rules?.[0];
        if (!updated) return;
        const index = inventoryRules.value.findIndex((rule: any) => ruleKey(rule) === ruleKey(updated));
        if (index >= 0) inventoryRules.value[index] = { ...inventoryRules.value[index], ...updated };
        const key = ruleKey(updated);
        if (rulesInformation.value[key]) rulesInformation.value[key] = { ...rulesInformation.value[key], ...updated };
        hasUnsavedChanges.value = true;
        initializeInventoryRules();
      }
    }
  })

  await archivedRuleModal.present();
}


async function save() {
  flushEditorDraft();
  if (isSandbox.value) {
    return false;
  }
  if (!group.value?.routingGroupId) {
    commonUtil.showToast(translate("Failed to save changes"));
    return false;
  }

  const previousRoutingId = activeRoutingId.value;
  const previousGroupId = group.value.routingGroupId;
  emitter.emit("presentLoader", { message: translate("Updating routing rules and filters"), backdropDismiss: false });
  try {
    // saveRoutingGroupRaw owns payload sanitization and performs the sole whole-group write.
    // Empty groups are valid: there is intentionally no active-routing dereference here.
    const savedGroup = await routingStore.saveRoutingGroupRaw(cloneSnapshotValue(group.value));

    proposalSnapshot.value = null;
    const savedGroupId = (savedGroup || currentRoutingGroup.value)?.routingGroupId || "";
    const replacementRoute = prepareRoutingGroupSaveCommit(previousGroupId, savedGroupId, () => {
      hasUnsavedChanges.value = false;
      emit("dirtyChange", false);
    });
    group.value = savedGroup || currentRoutingGroup.value;
    groupName.value = group.value.groupName || "";
    description.value = group.value.description || "";
    job.value = routingGroupScheduleWorkingCopy(group.value);

    const target = group.value.routings?.find((routing: any) => routingWorkingKey(routing) === previousRoutingId)
      || group.value.routings?.[0];
    if (target) selectRouting(target, false);
    else clearEditorSelection();

    if (replacementRoute) {
      await nextTick();
      await router.replace(replacementRoute);
    }

    commonUtil.showToast(translate("Changes saved successfully"));
    return true;
  } catch (err) {
    logger.error(err);
    commonUtil.showToast(translate("Failed to save changes"));
    return false;
  } finally {
    emitter.emit("dismissLoader");
  }
}

function syncActiveRuleDraft() {
  const key = activeRuleId.value || ruleWorkingKey(activeRule.value);
  if (!key || !activeRule.value) return;

  const projection = {
    ...cloneSnapshotValue(activeRule.value),
    inventoryFilters: {
      ENTCT_FILTER: cloneSnapshotValue(inventoryRuleFilterOptions.value),
      ENTCT_SORT_BY: cloneSnapshotValue(inventoryRuleSortOptions.value)
    },
    actions: cloneSnapshotValue(inventoryRuleActions.value)
  };
  rulesInformation.value[key] = projection;

  const serialized = serializeRuleWorkingCopy(
    activeRule.value,
    inventoryRuleFilterOptions.value,
    inventoryRuleSortOptions.value,
    inventoryRuleActions.value
  );
  inventoryRules.value = replaceWorkingEntry(inventoryRules.value, serialized, ruleWorkingKey);

  const listIndex = rulesForReorder.value.findIndex((rule: any) => ruleWorkingKey(rule) === key);
  if (listIndex >= 0) {
    const nextList = [...rulesForReorder.value];
    nextList[listIndex] = cloneSnapshotValue(serialized);
    rulesForReorder.value = nextList;
  }
}

function syncCachedRuleDrafts() {
  inventoryRules.value = inventoryRules.value.map((rawRule: any) => {
    const key = ruleWorkingKey(rawRule);
    const projection = rulesInformation.value[key];
    if (!projection) return rawRule;
    const projectedFilters = projection.inventoryFilters || {};
    return serializeRuleWorkingCopy(
      { ...rawRule, ...projection },
      projectedFilters.ENTCT_FILTER || {},
      projectedFilters.ENTCT_SORT_BY || {},
      projection.actions || {}
    );
  });
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
  if(routeName.value.trim() && routeName.value.trim() !== String(activeRouting.value?.routingName || "").trim()) {
    activeRouting.value.routingName = routeName.value.trim();
    routeName.value = routeName.value.trim();
    hasUnsavedChanges.value = true;
    flushEditorDraft();
  }
  isRouteNameUpdating.value = false
}

async function cloneRouting(routing: any) {
  if (isSandbox.value) return; // cloning a routing into a variation isn't supported (matches the sim flow)
  flushEditorDraft();
  const source = (group.value.routings || []).find((candidate: any) => routingWorkingKey(candidate) === routingWorkingKey(routing));
  if (!source) return;
  const orderRoutingId = createClientUuid();
  const cloned = cloneSnapshotValue(source);
  cloned._tempId = `temp-routing-${++tempIdCounter}`;
  cloned.orderRoutingId = orderRoutingId;
  cloned.routingGroupId = group.value.routingGroupId;
  cloned.routingName = `${source.routingName || "Routing"} copy`;
  const tail = group.value.routings?.[group.value.routings.length - 1];
  cloned.sequenceNum = tail?.sequenceNum >= 0 ? Number(tail.sequenceNum) + 5 : 0;
  cloned.rules = (cloned.rules || []).map((rule: any) => {
    const routingRuleId = createClientUuid();
    return {
      ...rule,
      _tempId: `temp-rule-${++tempIdCounter}`,
      routingRuleId,
      orderRoutingId,
      inventoryFilters: (rule.inventoryFilters || []).map((filter: any) => ({ ...filter, routingRuleId })),
      actions: (rule.actions || []).map((action: any) => ({ ...action, routingRuleId }))
    };
  });
  group.value.routings = commonUtil.sortSequence([...(group.value.routings || []), cloned]);
  hasUnsavedChanges.value = true;
  selectRouting(cloned, false);
  commonUtil.showToast(translate("Route cloned successfully"));
}

async function updateRoutingStatus(statusId: string) {
  if (!activeRouting.value) return;
  activeRouting.value.statusId = statusId;
  hasUnsavedChanges.value = true;
  flushEditorDraft();
}

function updateOrderFilterValue(event: CustomEvent, fieldName: string, multi = false) {
  orderRoutingFilterOptions.value = updateRoutingFilterCondition(
    orderRoutingFilterOptions.value,
    ruleEnums,
    fieldName,
    event.detail.value,
    multi
  )
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
  // A prior live store mutation (status/rename/rule edit) may have replaced store.currentGroup with a
  // fresh clone, leaving group.value aliasing the stale object. Re-point at the current store copy so
  // this reorder mutates the object Save actually posts (otherwise the reorder is dropped on Save).
  if (!isSandbox.value) group.value = currentRoutingGroup.value
  const previousSeq = JSON.parse(JSON.stringify(group.value.routings))
  const updatedSeq = event.detail.complete(JSON.parse(JSON.stringify(group.value.routings)));

  const updatedSeqenceNum = previousSeq.map((routing: any) => routing.sequenceNum)
  Object.keys(updatedSeq).map((key: any, index: number) => {
    updatedSeq[key].sequenceNum = updatedSeqenceNum[index]
  })

  group.value.routings = updatedSeq
  const updatedActiveRouting = updatedSeq.find((routing: any) => routingWorkingKey(routing) === activeRoutingId.value);
  if (updatedActiveRouting && activeRouting.value) activeRouting.value.sequenceNum = updatedActiveRouting.sequenceNum;
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
      const key = ruleKey(rule);
      if (rulesInformation.value[key]) rulesInformation.value[key].sequenceNum = updatedRule.sequenceNum;
    }
  })
  const updatedActiveRule = updatedSeq.find((rule: any) => ruleKey(rule) === activeRuleId.value);
  if (updatedActiveRule && activeRule.value) activeRule.value.sequenceNum = updatedActiveRule.sequenceNum;
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
  flushEditorDraft();
  const archivedRoutingModal = await modalController.create({
    component: ArchivedRoutingModal,
    componentProps: {
      archivedRoutings: group.value?.routings?.filter((routing: any) => routing.statusId === "ROUTING_ARCHIVED") || [],
      saveRoutings: (routings: any) => {
        const updated = routings?.[0];
        if (!updated) return;
        const index = (group.value.routings || []).findIndex((routing: any) => routingWorkingKey(routing) === routingWorkingKey(updated));
        if (index >= 0) group.value.routings[index] = { ...group.value.routings[index], ...updated };
        hasUnsavedChanges.value = true;
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

.variation-diff-summary {
  --padding-start: var(--spacer-sm);
  --inner-padding-end: var(--spacer-sm);
  margin: 0 var(--spacer-sm) var(--spacer-sm);
}

.variation-diff-summary h3 {
  margin-block: 0 var(--spacer-2xs);
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

.rule-status {
  margin-top: 2px;
}

.rule-item.dirty-row {
  --background: rgba(var(--ion-color-warning-rgb), 0.16);
}

.dirty-card {
  outline: 2px solid var(--ion-color-warning);
  outline-offset: -2px;
  overflow: hidden;
}

.dirty-setting-row {
  --background: rgba(var(--ion-color-warning-rgb), 0.16);
}

.routing-group-editor.interaction-locked {
  cursor: progress;
}

.rule-status.active {
  color: var(--ion-color-success);
}

.rule-status.archived {
  color: var(--ion-color-warning);
}

.rule-status.draft {
  color: var(--ion-color-medium);
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
  color: var(--ion-color-primary);
}

.action-prompt p {
  margin: 0;
  color: var(--ion-color-dark);
}

</style>
