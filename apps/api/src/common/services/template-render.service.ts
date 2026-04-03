import { Injectable } from "@nestjs/common";

type StudentLike = {
  id: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  admissionNumber?: string | null;
  employeeId?: string | null;
  className?: string | null;
  section?: string | null;
  department?: string | null;
  designation?: string | null;
  bloodGroup?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  rollNumber?: string | null;
  parentName?: string | null;
  parentMobile?: string | null;
  emergencyContact?: string | null;
  issueDate?: string | null;
  validityDate?: string | null;
  address?: string | null;
  photoKey?: string | null;
};

type SchoolLike = {
  id?: string;
  name: string;
  code: string;
  email?: string | null;
  address?: string | null;
};

@Injectable()
export class TemplateRenderService {
  getTokenCatalog() {
    return [
      { key: "student_name", label: "Student Name" },
      { key: "first_name", label: "First Name" },
      { key: "last_name", label: "Last Name" },
      { key: "student_id", label: "Student ID" },
      { key: "admission_number", label: "Admission Number" },
      { key: "employee_id", label: "Employee ID" },
      { key: "class", label: "Class" },
      { key: "section", label: "Section" },
      { key: "department", label: "Department" },
      { key: "designation", label: "Designation" },
      { key: "roll_number", label: "Roll Number" },
      { key: "blood_group", label: "Blood Group" },
      { key: "date_of_birth", label: "Date of Birth" },
      { key: "gender", label: "Gender" },
      { key: "parent_name", label: "Parent Name" },
      { key: "parent_mobile", label: "Parent Mobile" },
      { key: "emergency_contact", label: "Emergency Contact" },
      { key: "address", label: "Address" },
      { key: "school_name", label: "School Name" },
      { key: "school_code", label: "School Code" },
      { key: "school_email", label: "School Email" },
      { key: "institution_name", label: "Institution Name" },
      { key: "institution_address", label: "Institution Address" },
      { key: "issued_on", label: "Issued Date" },
      { key: "valid_till", label: "Validity Date" }
    ];
  }

  buildTokenMap(student: StudentLike, school: SchoolLike) {
    const issuedOn = new Date().toISOString().slice(0, 10);
    const [derivedFirstName = "", ...rest] = (student.fullName || "").trim().split(/\s+/);
    const derivedLastName = rest.join(" ");
    const issueDate = student.issueDate || issuedOn;
    return {
      student_name: student.fullName || "",
      first_name: student.firstName || derivedFirstName || "",
      last_name: student.lastName || derivedLastName || "",
      student_id: student.id || "",
      admission_number: student.admissionNumber || "",
      employee_id: student.employeeId || "",
      class: student.className || "",
      section: student.section || "",
      department: student.department || "",
      designation: student.designation || "",
      roll_number: student.rollNumber || "",
      blood_group: student.bloodGroup || "",
      date_of_birth: student.dateOfBirth || "",
      gender: student.gender || "",
      parent_name: student.parentName || "",
      parent_mobile: student.parentMobile || "",
      emergency_contact: student.emergencyContact || student.parentMobile || "",
      address: student.address || "",
      school_name: school.name || "",
      school_code: school.code || "",
      school_email: school.email || "",
      institution_name: school.name || "",
      institution_address: school.address || "",
      issued_on: issueDate,
      valid_till: student.validityDate || ""
    };
  }

  extractTokens(value: unknown, collector = new Set<string>()) {
    if (typeof value === "string") {
      const matches = value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
      for (const match of matches) {
        if (match[1]) collector.add(match[1]);
      }
      return collector;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => this.extractTokens(item, collector));
      return collector;
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      Object.values(obj).forEach((v) => this.extractTokens(v, collector));
      if (typeof obj.token === "string") collector.add(obj.token);
      return collector;
    }
    return collector;
  }

  validateTemplateDefinition(input: {
    mappingJson: Record<string, unknown>;
    frontLayoutJson?: Record<string, unknown>;
    backLayoutJson?: Record<string, unknown>;
  }) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.mappingJson || typeof input.mappingJson !== "object") {
      errors.push("mappingJson must be a valid object");
    }

    const validateLayout = (layout: Record<string, unknown> | undefined, side: "front" | "back") => {
      if (!layout || Object.keys(layout).length === 0) {
        warnings.push(`${side}LayoutJson is empty; fallback render will be used`);
        return;
      }

      const elements = Array.isArray(layout.elements) ? layout.elements : [];
      if (!elements.length) {
        warnings.push(`${side} layout has no elements`);
        return;
      }

      elements.forEach((element, index) => {
        if (!element || typeof element !== "object") {
          errors.push(`${side} element #${index + 1} is invalid`);
          return;
        }
        const current = element as Record<string, unknown>;
        if (typeof current.id !== "string" || !current.id.trim()) {
          errors.push(`${side} element #${index + 1} requires id`);
        }
        if (typeof current.type !== "string" || !current.type.trim()) {
          errors.push(`${side} element #${index + 1} requires type`);
        }
        for (const key of ["x", "y", "width", "height"]) {
          if (current[key] !== undefined && typeof current[key] !== "number") {
            errors.push(`${side} element ${String(current.id || index + 1)} has invalid ${key}`);
          }
        }
      });
    };

    validateLayout(input.frontLayoutJson, "front");
    validateLayout(input.backLayoutJson, "back");

    const catalog = new Set(this.getTokenCatalog().map((token) => token.key));
    const discoveredTokens = [...this.extractTokens(input.mappingJson)];
    discoveredTokens.forEach((token) => {
      if (!catalog.has(token)) warnings.push(`Unknown token in mapping: ${token}`);
    });

    const requiredTokens = discoveredTokens.filter((token) =>
      ["student_name", "student_id", "class", "section", "roll_number", "parent_name", "parent_mobile"].includes(
        token
      )
    );

    return {
      errors,
      warnings,
      discoveredTokens: [...new Set(discoveredTokens)],
      requiredTokens: [...new Set(requiredTokens)]
    };
  }

  validateRecordForTemplate(requiredTokens: string[], student: StudentLike) {
    const tokenMap = this.buildTokenMap(student, { name: "", code: "", email: "" });
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const token of requiredTokens) {
      const value = tokenMap[token as keyof typeof tokenMap];
      if (!value || !String(value).trim()) {
        errors.push(`Missing required field for token: ${token}`);
      }
    }

    if (!student.photoKey) warnings.push("Photo missing; placeholder will be used");
    if ((student.fullName || "").length > 40) warnings.push("Name may overflow depending on card design");
    if ((student.address || "").length > 80) warnings.push("Address may overflow in compact cards");

    return { errors, warnings };
  }

  renderJsonWithTokens(value: unknown, tokenMap: Record<string, string>): unknown {
    if (typeof value === "string") {
      return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => tokenMap[key] ?? "");
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.renderJsonWithTokens(item, tokenMap));
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
        out[k] = this.renderJsonWithTokens(v, tokenMap);
      });
      return out;
    }
    return value;
  }

  buildPreviewPayload(
    mappingJson: Record<string, unknown>,
    student: StudentLike,
    school: SchoolLike,
    templateVersion: number,
    extras?: Record<string, unknown>
  ) {
    const tokenMap = this.buildTokenMap(student, school);
    return {
      templateVersion,
      tokenMap,
      preview: this.renderJsonWithTokens(mappingJson, tokenMap),
      overflowHints: {
        fullName: (student.fullName || "").length > 40,
        address: (student.address || "").length > 80
      },
      ...(extras || {})
    };
  }
}
