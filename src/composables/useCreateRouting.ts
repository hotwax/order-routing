import { alertController } from "@ionic/vue";
import { DateTime } from "luxon";
import { commonUtil, translate } from "@common";
import { orderRoutingStore } from "@/store/orderRoutingStore";

export interface CreateRoutingOptions {
  routingGroupId: string;
  existingRoutings?: any[];
  onCreated?: (newRoutingId: string) => void | Promise<void>;
}

export function useCreateRouting() {
  async function promptCreateRouting(opts: CreateRoutingOptions): Promise<void> {
    if (!opts.routingGroupId) return;

    const alert = await alertController.create({
      header: translate("New routing"),
      inputs: [{ name: "routingName", placeholder: translate("routing name") }],
      buttons: [
        { text: translate("Cancel"), role: "cancel" },
        {
          text: translate("Save"),
          handler: (data: any) => {
            if (!data.routingName?.trim().length) {
              commonUtil.showToast(translate("Please enter a valid name"));
              return false;
            }
          }
        }
      ]
    });

    alert.onDidDismiss().then(async (result: any) => {
      if (result.role) return;
      const routingName = result.data?.values?.routingName?.trim();
      if (!routingName) return;

      const existing = opts.existingRoutings || [];
      const tail = existing[existing.length - 1];
      const sequenceNum = tail?.sequenceNum >= 0 ? tail.sequenceNum + 5 : 0;

      const newRoutingId = await orderRoutingStore().createOrderRouting({
        orderRoutingId: "",
        routingGroupId: opts.routingGroupId,
        statusId: "ROUTING_DRAFT",
        routingName,
        sequenceNum,
        description: "",
        createdDate: DateTime.now().toMillis()
      });
      if (!newRoutingId) return;
      await opts.onCreated?.(newRoutingId);
    });

    return alert.present();
  }

  return { promptCreateRouting };
}
