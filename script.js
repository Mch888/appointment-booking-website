"use strict";
let isDatabaseReady = false;

const threeMinutesInMilliseconds = 3 * 60 * 1000;
const threeDaysInMilliseconds = 3 * 24 * 60 * 60 * 1000;
const bookingStorageKey = "studioNorthBookingProgress";
const cookieTestName = "studioNorthCookieTest";

const setCookie = (name, value, expiresAt) => {
	document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expiresAt.toUTCString()}; path=/; SameSite=Lax`;
};

const readCookie = (name) => {
	const prefix = `${name}=`;
	const cookie = document.cookie.split("; ").find((item) => item.startsWith(prefix));
	return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
};

const deleteCookie = (name) => {
	document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
};

const checkCookies = () => {
	const testValue = String(Date.now());
	setCookie(cookieTestName, testValue, new Date(Date.now() + threeMinutesInMilliseconds));
	const cookiesWork = readCookie(cookieTestName) === testValue;

	if (cookiesWork) {
		deleteCookie(cookieTestName);
	}

	return cookiesWork;
};

const cookieGate = document.getElementById("cookie-gate");

if (document.body.classList.contains("cookie-check-pending")) {
	if (checkCookies()) {
		document.body.classList.remove("cookie-check-pending");
	} else if (cookieGate) {
		cookieGate.hidden = false;
	}
}

document.querySelector("[data-reload-page]")?.addEventListener("click", () => {
	window.location.reload();
});

const cookieNotice = document.getElementById("cookie-notice");

document.querySelectorAll('a[href^="#"]').forEach((link) => {
	link.addEventListener("click", (event) => {
		const targetId = link.getAttribute("href");

		if (!targetId || targetId === "#") {
			return;
		}

		const target = document.querySelector(targetId);

		if (!target) {
			return;
		}

		event.preventDefault();
		target.scrollIntoView({ behavior: "smooth", block: "start" });
	});
});

if (cookieNotice) {
	cookieNotice.addEventListener("click", (event) => {
		const actionTrigger = event.target.closest("[data-cookie-action]");

		if (!actionTrigger) {
			return;
		}

		if (actionTrigger.dataset.cookieAction === "accept") {
			cookieNotice.classList.add("is-hidden");
		}
	});
}

const bookingSteps = Array.from(document.querySelectorAll("[data-step]"));

if (bookingSteps.length > 0) {
	try {
		window.localStorage.removeItem(bookingStorageKey);
	} catch (error) {
		// Local storage may be unavailable.
	}

	const bookingState = {
		service: "",
		staff: "",
		date: "",
		time: "",
		name: "",
		email: "",
		phone: ""
	};

	const progressItems = Array.from(document.querySelectorAll("[data-progress-item]"));
	const summaryFields = document.querySelectorAll("[data-summary]");
	const confirmationCard = document.getElementById("booking-confirmation");
	let currentStep = 1;

	const updateSummary = () => {
		summaryFields.forEach((field) => {
			const key = field.dataset.summary;
			let value = bookingState[key];

			if (!value) {
				value = key === "phone" ? "Optional" : key === "name" || key === "email" ? "Not entered" : "Not selected";
			}

			field.textContent = value;
		});
	};

	const showStep = (stepNumber) => {
		currentStep = stepNumber;
		bookingSteps.forEach((step) => {
			step.hidden = Number(step.dataset.step) !== stepNumber;
		});

		progressItems.forEach((item) => {
			item.classList.toggle("is-active", Number(item.dataset.progressItem) === stepNumber);
		});

		if (confirmationCard) {
			confirmationCard.hidden = true;
		}

		document.querySelector(`[data-step="${stepNumber}"] input`)?.focus();
	};

	const collectInputs = () => {
		const inputs = document.querySelectorAll("[data-booking-input]");

		inputs.forEach((input) => {
			const key = input.dataset.bookingInput;

			bookingState[key] = input.value.trim();
		});
	};

	const saveProgress = () => {
		if (isDatabaseReady) {
			return;
		}

		const draft = {
			currentStep: Math.min(currentStep, 5),
			bookingState: {
				service: bookingState.service,
				staff: bookingState.staff,
				date: bookingState.date,
				time: bookingState.time
			}
		};
		const hasDraft = Object.values(draft.bookingState).some((value) => value !== "");

		if (hasDraft) {
			setCookie(bookingStorageKey, JSON.stringify(draft), new Date(Date.now() + threeDaysInMilliseconds));
		}
	};

	const readSavedProgress = () => {
		if (isDatabaseReady) {
			return "";
		}

		return readCookie(bookingStorageKey);
	};

	const clearSavedProgress = () => {
		try {
			window.localStorage.removeItem(bookingStorageKey);
		} catch (error) {
			// Old local drafts may not exist or local storage may be unavailable.
		}
		deleteCookie(bookingStorageKey);
	};

	const restoreProgress = (savedValue) => {
		try {
			const saved = JSON.parse(savedValue);
			const savedState = saved.bookingState || {};
			bookingState.service = savedState.service || "";
			bookingState.staff = savedState.staff || "";
			bookingState.date = savedState.date || "";
			bookingState.time = savedState.time || "";

			document.querySelectorAll("[data-booking-field]").forEach((button) => {
				button.classList.toggle("is-selected", bookingState[button.dataset.bookingField] === button.dataset.value);
			});

			document.querySelectorAll("[data-booking-input]").forEach((input) => {
				input.value = bookingState[input.dataset.bookingInput] || "";
			});

			updateSummary();
			showStep(Math.min(Math.max(Number(saved.currentStep) || 1, 1), 5));
			saveProgress();
		} catch (error) {
			clearSavedProgress();
			showStep(1);
		}
	};

	const advanceStep = () => {
		collectInputs();
		updateSummary();
		showStep(Math.min(currentStep + 1, bookingSteps.length));
		saveProgress();
		window.scrollTo({ top: document.getElementById("booking-flow")?.offsetTop || 0, behavior: "smooth" });
	};

	document.querySelectorAll("[data-booking-field]").forEach((button) => {
		button.addEventListener("click", () => {
			const key = button.dataset.bookingField;
			const value = button.dataset.value;

			document.querySelectorAll(`[data-booking-field="${key}"]`).forEach((candidate) => {
				candidate.classList.toggle("is-selected", candidate === button);
			});

			bookingState[key] = value;
			updateSummary();
			saveProgress();
			window.setTimeout(advanceStep, 180);
		});
	});

	document.querySelectorAll("[data-booking-input]").forEach((input) => {
		input.addEventListener("input", () => {
			collectInputs();
			updateSummary();
		});

		input.addEventListener("change", () => {
			collectInputs();
			updateSummary();
			saveProgress();

			if (input.dataset.bookingInput === "date" && input.value) {
				advanceStep();
			}

			if (input.hasAttribute("data-advance-input") && input.value && input.checkValidity()) {
				advanceStep();
			}
		});

		if (input.hasAttribute("data-advance-input")) {
			input.addEventListener("keydown", (event) => {
				if (event.key === "Enter" && input.checkValidity()) {
					event.preventDefault();
					advanceStep();
				}
			});
		}
	});

	document.querySelectorAll("[data-next-step]").forEach((button) => {
		button.addEventListener("click", () => {
			const currentInput = document.querySelector(`[data-step="${currentStep}"] [required]`);

			if (currentInput && !currentInput.reportValidity()) {
				return;
			}

			advanceStep();
		});
	});

	document.querySelector("[data-skip-step]")?.addEventListener("click", advanceStep);

	document.querySelectorAll("[data-prev-step]").forEach((button) => {
		button.addEventListener("click", () => {
			showStep(Math.max(currentStep - 1, 1));
			saveProgress();
			window.scrollTo({ top: document.getElementById("booking-flow")?.offsetTop || 0, behavior: "smooth" });
		});
	});

	const confirmButton = document.querySelector("[data-confirm-booking]");

	if (confirmButton && confirmationCard) {
		confirmButton.addEventListener("click", () => {
			collectInputs();
			updateSummary();
			bookingSteps.forEach((step) => {
				step.hidden = true;
			});
			progressItems.forEach((item) => {
				item.classList.remove("is-active");
			});
			confirmationCard.hidden = false;
			clearSavedProgress();
			window.scrollTo({ top: 0, behavior: "smooth" });
		});
	}

	updateSummary();
	showStep(1);

	const savedProgress = readSavedProgress();

	if (savedProgress) {
		restoreProgress(savedProgress);
	}
}
