import { commonUtil } from "@common";

const DEFAULT_PRODUCT_IDENTIFIER_PREF = {
  primaryId: "SKU",
  secondaryId: "productId"
}

function normalizeProduct(product: any) {
  if (!product) return {};

  const goodIdentifications = Array.isArray(product.goodIdentifications)
    ? product.goodIdentifications.map((identification: any) => {
        if (typeof identification === "string") return identification;

        const type = identification.type
          || identification.goodIdentificationTypeId
          || identification.idType
          || identification.identKey
          || identification.goodIdentificationType;
        const value = identification.value
          || identification.idValue
          || identification.identValue
          || identification.goodIdentificationValue;

        return type && value ? { type, value } : identification;
      })
    : product.goodIdentifications;

  return {
    ...product,
    goodIdentifications
  }
}

function getIdentifierPref(productIdentificationPref: any) {
  return {
    primaryId: productIdentificationPref?.primaryId || DEFAULT_PRODUCT_IDENTIFIER_PREF.primaryId,
    secondaryId: productIdentificationPref?.secondaryId || DEFAULT_PRODUCT_IDENTIFIER_PREF.secondaryId
  }
}

function isUsableInternalName(value: any, productId: any) {
  if (!value) return false;
  const internalName = String(value).trim();
  if (!internalName || internalName === String(productId || "")) return false;
  return !/^\d{10,}$/.test(internalName);
}

function getProductIdentificationValue(identifier: string, product: any) {
  if (!identifier) return "";
  return commonUtil.getProductIdentificationValue(identifier, normalizeProduct(product)) || "";
}

export function getPrimaryProductIdentifier(productIdentificationPref: any, product: any) {
  const normalizedProduct = normalizeProduct(product);
  const pref = getIdentifierPref(productIdentificationPref);

  return getProductIdentificationValue(pref.primaryId, normalizedProduct)
    || (isUsableInternalName(normalizedProduct.internalName, normalizedProduct.productId) ? normalizedProduct.internalName : "")
    || normalizedProduct.productName
    || normalizedProduct.parentProductName
    || normalizedProduct.title
    || normalizedProduct.productId
    || "";
}

export function getSecondaryProductIdentifier(productIdentificationPref: any, product: any) {
  const normalizedProduct = normalizeProduct(product);
  const pref = getIdentifierPref(productIdentificationPref);

  return getProductIdentificationValue(pref.secondaryId, normalizedProduct)
    || normalizedProduct.productId
    || "";
}
