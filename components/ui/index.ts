/**
 * Barrel export for the UI primitives.
 *
 * Every page and feature component composes from here, so restyling the site
 * means editing `app/globals.css` and these files — nothing else.
 */
export { Badge, type BadgeTone } from "@/components/ui/Badge";
export {
  Button,
  ButtonLink,
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/Button";
export { Card, CardBody, CardHeader } from "@/components/ui/Card";
export { Checkbox } from "@/components/ui/Checkbox";
export { Container, type ContainerWidth } from "@/components/ui/Container";
export { DataList, type Column } from "@/components/ui/DataList";
export { EmptyState } from "@/components/ui/EmptyState";
export { ErrorMessage } from "@/components/ui/ErrorMessage";
export { Field, controlClasses, describedBy, fieldIds } from "@/components/ui/Field";
export { Input } from "@/components/ui/Input";
export { QuantitySelector } from "@/components/ui/QuantitySelector";
export { Select } from "@/components/ui/Select";
export { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
export { Spinner } from "@/components/ui/Spinner";
export { Stepper, type StepperStep } from "@/components/ui/Stepper";
export { Textarea } from "@/components/ui/Textarea";
