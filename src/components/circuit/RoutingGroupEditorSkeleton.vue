<template>
  <div
    class="routing-editor-skeleton"
    role="status"
    aria-live="polite"
    :aria-label="translate('Loading routing details')"
  >
    <div class="skeleton-column skeleton-group-column" aria-hidden="true">
      <ion-card class="skeleton-card skeleton-group-card">
        <ion-card-header>
          <ion-skeleton-text animated class="skeleton-line skeleton-title" />
          <ion-skeleton-text animated class="skeleton-line skeleton-id" />
          <ion-skeleton-text animated class="skeleton-line skeleton-copy" />
          <ion-skeleton-text animated class="skeleton-line skeleton-copy-short" />
        </ion-card-header>
        <ion-card-content>
          <div class="skeleton-actions">
            <ion-skeleton-text v-for="action in 3" :key="`group-action-${action}`" animated class="skeleton-button" />
          </div>
          <div v-for="row in 3" :key="`group-row-${row}`" class="skeleton-row">
            <ion-skeleton-text animated class="skeleton-line skeleton-label" />
            <ion-skeleton-text animated class="skeleton-line skeleton-value" />
          </div>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="!sandbox" class="skeleton-card skeleton-schedule-card">
        <ion-card-header class="skeleton-card-heading">
          <div>
            <ion-skeleton-text animated class="skeleton-line skeleton-overline" />
            <ion-skeleton-text animated class="skeleton-line skeleton-subtitle" />
          </div>
          <ion-skeleton-text animated class="skeleton-button skeleton-button-compact" />
        </ion-card-header>
        <ion-card-content>
          <ion-skeleton-text animated class="skeleton-line skeleton-copy-short" />
          <div class="skeleton-actions skeleton-actions-spread">
            <ion-skeleton-text animated class="skeleton-button skeleton-button-compact" />
            <ion-skeleton-text animated class="skeleton-line skeleton-action-link" />
          </div>
        </ion-card-content>
      </ion-card>

      <div class="skeleton-list-heading">
        <ion-skeleton-text animated class="skeleton-line skeleton-subtitle" />
        <ion-skeleton-text animated class="skeleton-line skeleton-action-link" />
      </div>
      <ion-card v-for="routing in 3" :key="`routing-${routing}`" class="skeleton-card skeleton-list-card">
        <ion-card-content>
          <div class="skeleton-row skeleton-row-first">
            <ion-skeleton-text animated class="skeleton-line skeleton-routing-name" />
            <ion-skeleton-text animated class="skeleton-chip" />
          </div>
          <ion-skeleton-text animated class="skeleton-badge" />
        </ion-card-content>
      </ion-card>
    </div>

    <div class="skeleton-column skeleton-routing-column" aria-hidden="true">
      <ion-card class="skeleton-card skeleton-summary-card">
        <ion-card-content class="skeleton-summary-content">
          <div>
            <ion-skeleton-text animated class="skeleton-line skeleton-overline" />
            <ion-skeleton-text animated class="skeleton-line skeleton-summary-title" />
            <div class="skeleton-actions">
              <ion-skeleton-text animated class="skeleton-button" />
              <ion-skeleton-text animated class="skeleton-button" />
            </div>
          </div>
          <div>
            <ion-skeleton-text animated class="skeleton-line skeleton-label" />
            <ion-skeleton-text animated class="skeleton-line skeleton-value" />
          </div>
        </ion-card-content>
      </ion-card>

      <div class="skeleton-config-grid">
        <ion-card v-for="card in 2" :key="`routing-config-${card}`" class="skeleton-card skeleton-config-card">
          <ion-card-header class="skeleton-card-heading">
            <ion-skeleton-text animated class="skeleton-icon" />
            <ion-skeleton-text animated class="skeleton-line skeleton-subtitle" />
          </ion-card-header>
          <ion-card-content>
            <div v-for="row in 3" :key="`routing-config-${card}-${row}`" class="skeleton-row">
              <ion-skeleton-text animated class="skeleton-line skeleton-label" />
              <ion-skeleton-text animated class="skeleton-line skeleton-value" />
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card class="skeleton-card skeleton-rules-card">
          <ion-card-header class="skeleton-card-heading">
            <ion-skeleton-text animated class="skeleton-line skeleton-subtitle" />
            <ion-skeleton-text animated class="skeleton-icon" />
          </ion-card-header>
          <ion-card-content>
            <div v-for="rule in 4" :key="`rule-${rule}`" class="skeleton-row skeleton-rule-row">
              <div>
                <ion-skeleton-text animated class="skeleton-line skeleton-routing-name" />
                <ion-skeleton-text animated class="skeleton-line skeleton-rule-status" />
              </div>
              <ion-skeleton-text animated class="skeleton-icon skeleton-reorder" />
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </div>

    <div class="skeleton-column skeleton-rule-column" aria-hidden="true">
      <ion-card class="skeleton-card skeleton-rule-summary-card">
        <ion-card-header>
          <ion-skeleton-text animated class="skeleton-line skeleton-overline" />
          <ion-skeleton-text animated class="skeleton-line skeleton-summary-title" />
          <ion-skeleton-text animated class="skeleton-button skeleton-button-compact" />
        </ion-card-header>
      </ion-card>

      <div class="skeleton-rule-grid">
        <ion-card v-for="card in 4" :key="`rule-config-${card}`" class="skeleton-card skeleton-config-card">
          <ion-card-header class="skeleton-card-heading">
            <ion-skeleton-text animated class="skeleton-icon" />
            <ion-skeleton-text animated class="skeleton-line skeleton-subtitle" />
          </ion-card-header>
          <ion-card-content>
            <div v-for="row in card > 2 ? 2 : 3" :key="`rule-config-${card}-${row}`" class="skeleton-row">
              <ion-skeleton-text animated class="skeleton-line skeleton-label" />
              <ion-skeleton-text animated class="skeleton-line skeleton-value" />
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonSkeletonText
} from "@ionic/vue";
import { translate } from "@common";

defineProps({
  sandbox: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped>
.routing-editor-skeleton {
  display: grid;
  grid-template-columns: repeat(6, 350px);
  column-gap: var(--spacer-base);
  block-size: 100%;
  overflow: auto;
  align-items: start;
}

.skeleton-column {
  min-block-size: 100%;
  padding-block-end: var(--spacer-2xl);
}

.skeleton-group-column {
  grid-column: 1;
}

.skeleton-routing-column {
  grid-column: 2 / 4;
}

.skeleton-rule-column {
  grid-column: 4 / 6;
}

.skeleton-card {
  margin: var(--spacer-sm);
  overflow: hidden;
}

.skeleton-group-card {
  min-block-size: 296px;
}

.skeleton-schedule-card {
  min-block-size: 164px;
}

.skeleton-summary-card {
  min-block-size: 132px;
}

.skeleton-rule-summary-card {
  min-block-size: 120px;
}

.skeleton-list-card {
  min-block-size: 88px;
}

.skeleton-line,
.skeleton-button,
.skeleton-chip,
.skeleton-badge,
.skeleton-icon {
  margin: 0;
  border-radius: 999px;
}

.skeleton-title {
  inline-size: 58%;
  block-size: 24px;
}

.skeleton-id,
.skeleton-overline,
.skeleton-rule-status {
  inline-size: 28%;
  block-size: 10px;
  margin-block-start: var(--spacer-xs);
}

.skeleton-copy {
  inline-size: 88%;
  block-size: 12px;
  margin-block-start: var(--spacer-base);
}

.skeleton-copy-short {
  inline-size: 64%;
  block-size: 12px;
  margin-block-start: var(--spacer-xs);
}

.skeleton-actions {
  display: flex;
  gap: var(--spacer-xs);
  margin-block: var(--spacer-xs) var(--spacer-base);
}

.skeleton-actions-spread {
  justify-content: space-between;
  align-items: center;
  margin-block-end: 0;
}

.skeleton-button {
  inline-size: 30%;
  block-size: 30px;
}

.skeleton-button-compact {
  inline-size: 104px;
}

.skeleton-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacer-base);
  min-block-size: 44px;
}

.skeleton-row-first {
  min-block-size: 36px;
}

.skeleton-label {
  inline-size: 34%;
  block-size: 12px;
}

.skeleton-value {
  inline-size: 42%;
  block-size: 12px;
}

.skeleton-card-heading,
.skeleton-summary-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacer-base);
}

.skeleton-card-heading > div,
.skeleton-summary-content > div {
  flex: 1;
}

.skeleton-subtitle {
  inline-size: 120px;
  block-size: 18px;
}

.skeleton-summary-title {
  inline-size: 220px;
  block-size: 24px;
  margin-block-start: var(--spacer-xs);
}

.skeleton-action-link {
  inline-size: 72px;
  block-size: 12px;
}

.skeleton-list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacer-base) var(--spacer-sm) var(--spacer-xs);
}

.skeleton-routing-name {
  inline-size: 170px;
  block-size: 14px;
}

.skeleton-chip {
  inline-size: 54px;
  block-size: 32px;
}

.skeleton-badge {
  inline-size: 60px;
  block-size: 18px;
  margin-block-start: var(--spacer-xs);
}

.skeleton-config-grid,
.skeleton-rule-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.skeleton-config-card {
  min-block-size: 176px;
}

.skeleton-rules-card {
  min-block-size: 238px;
}

.skeleton-rule-row {
  min-block-size: 48px;
}

.skeleton-icon {
  inline-size: 20px;
  block-size: 20px;
  flex: 0 0 auto;
}

.skeleton-reorder {
  inline-size: 24px;
  block-size: 10px;
}
</style>
