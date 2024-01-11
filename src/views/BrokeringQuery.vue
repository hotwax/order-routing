<template>
  <ion-page>
    <ion-content>
      <div>
        <div class="menu">
          <ion-item lines="none">
            <ion-label>{{ "<order lookup name>" }}</ion-label>
            <ion-chip slot="end" outline @click="router.push('route')">
              {{ "2/4" }}
              <ion-icon :icon="chevronUpOutline" />
            </ion-chip>
          </ion-item>
          <ion-button expand="block">{{ "Save Changes" }}</ion-button>
          <ion-item-group>
            <ion-item-divider color="medium">
              <ion-label>{{ "Filters" }}</ion-label>
            </ion-item-divider>
            <ion-item>
              <ion-select label="Queue" value="Brokering Queue">
                <ion-select-option value="Brokering Queue">{{ "Brokering Queue" }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-select label="Shipping method" value="Next Day">
                <ion-select-option value="Next Day">{{ "Next Day" }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-select label="Order priority" value="High">
                <ion-select-option value="High">{{ "High" }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label>{{ "Promise date" }}</ion-label>
              <ion-chip>{{ "select date" }}</ion-chip>
            </ion-item>
            <ion-item>
              <ion-select label="Queue" value="Brokering Queue">
                <ion-select-option value="Brokering Queue">{{ "Brokering Queue" }}</ion-select-option>
              </ion-select>
            </ion-item>
          </ion-item-group>
          <ion-item-group>
            <ion-item-divider color="medium">
              <ion-label>{{ "Sort" }}</ion-label>
            </ion-item-divider>
            <ion-reorder-group :disabled="false">
              <ion-item>
                <ion-label>{{ "Ship by" }}</ion-label>
                <ion-reorder />
              </ion-item>
              <ion-item>
                <ion-label>{{ "Ship after" }}</ion-label>
                <ion-reorder />
              </ion-item>
              <ion-item>
                <ion-label>{{ "Order date" }}</ion-label>
                <ion-reorder />
              </ion-item>
              <ion-item>
                <ion-label>{{ "Shipping method" }}</ion-label>
                <ion-reorder />
              </ion-item>
            </ion-reorder-group>
          </ion-item-group>
        </div>
        <div class="menu">
          <ion-list>
            <ion-reorder-group :disabled="false">
              <ion-item>
                <ion-label>{{ "Warehouse only" }}</ion-label>
                <ion-reorder />
              </ion-item>
              <ion-item>
                <ion-label>{{ "Warehouse and stores" }}</ion-label>
                <ion-reorder />
              </ion-item>
              <ion-item>
                <ion-label>{{ "Any Location" }}</ion-label>
                <ion-reorder />
              </ion-item>
            </ion-reorder-group>
          </ion-list>
        </div>
        <div>
          <section class="filters">
            <ion-card>
              <ion-item>
                <ion-icon slot="start" :icon="filterOutline"/>
                <ion-label>{{ "Filters" }}</ion-label>
                <ion-icon :icon="optionsOutline"/>
              </ion-item>
              <ion-item>
                <ion-select label="Group" value="East coast stores">
                  <ion-select-option value="East coast stores">{{ "East coast stores" }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-select label="Proximity" value="Zone 1">
                  <ion-select-option value="Zone 1">{{ "Zone 1" }}</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-label>{{ "Brokering safety stock" }}</ion-label>
                <ion-chip>{{ "3" }}</ion-chip>
              </ion-item>
            </ion-card>
            <ion-card>
              <ion-item>
                <ion-icon slot="start" :icon="swapVerticalOutline"/>
                <ion-label>{{ "Sort" }}</ion-label>
                <ion-icon :icon="optionsOutline"/>
              </ion-item>
              <ion-reorder-group :disabled="false">
                <ion-item>
                  <ion-label>{{ "Proximity" }}</ion-label>
                  <ion-reorder />
                </ion-item>
                <ion-item>
                  <ion-label>{{ "Order limit" }}</ion-label>
                  <ion-reorder />
                </ion-item>
                <ion-item>
                  <ion-label>{{ "Inventory balance" }}</ion-label>
                  <ion-reorder />
                </ion-item>
                <ion-item>
                  <ion-label>{{ "Custom Sequence" }}</ion-label>
                  <ion-reorder />
                </ion-item>
              </ion-reorder-group>
            </ion-card>
          </section>
          <section>
            <h2 class="ion-padding-start">{{ "Actions" }}</h2>
            <div class="actions">
              <ion-card>
                <ion-item lines="none">
                  <ion-label>{{ "Fully available" }}</ion-label>
                </ion-item>
                <ion-item lines="none">
                  <ion-chip>{{ "Next rule" }}</ion-chip>
                  <ion-chip>{{ "Move to queue" }}</ion-chip>
                  <ion-chip>
                    <ion-icon slot="start" :icon="checkmarkOutline" />
                    {{ "Auto cancel days: 10" }}
                  </ion-chip>
                </ion-item>
              </ion-card>
              <ion-card>
                <ion-item lines="none">
                  <ion-label>{{ "Partially available" }}</ion-label>
                </ion-item>
                <ion-item lines="none">
                  <ion-chip>
                    <ion-icon :icon="checkmarkOutline" />
                    <ion-label>{{ "Allocate partial" }}</ion-label>
                  </ion-chip>
                  <ion-chip>{{ "Next rule" }}</ion-chip>
                  <ion-chip>{{ "Move to queue" }}</ion-chip>
                  <ion-chip>
                    <ion-icon :icon="checkmarkOutline" />
                    <ion-label>{{ "Auto cancel days: 10" }}</ion-label>
                  </ion-chip>
                </ion-item>
              </ion-card>
              <ion-card>
                <ion-item lines="none">
                  <ion-label>{{ "Not available" }}</ion-label>
                </ion-item>
                <ion-item lines="none">
                  <ion-chip>{{ "Move to queue" }}</ion-chip>
                  <ion-chip>{{ "Next rule" }}</ion-chip>
                  <ion-chip>
                    <ion-icon :icon="checkmarkOutline"/>
                    <ion-label>{{ "Auto cancel days: 10" }}</ion-label>
                  </ion-chip>
                </ion-item>
              </ion-card>
            </div>
          </section>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonButton, IonCard, IonChip, IonContent, IonIcon, IonItem, IonItemDivider, IonItemGroup, IonLabel, IonList, IonPage, IonReorder, IonReorderGroup, IonSelect, IonSelectOption } from "@ionic/vue";
import { checkmarkOutline, chevronUpOutline, filterOutline, optionsOutline, swapVerticalOutline } from "ionicons/icons"
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<style scoped>
.actions, .filters {
  display: grid;
  grid-template-columns: repeat(2, auto);
}

ion-content > div {
  display: grid;
  grid-template-columns: 300px 300px 1fr;
  height: 100%;
}

ion-content > div > .menu {
  border-right: 1px solid #92949C;
}
</style>
