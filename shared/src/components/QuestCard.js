"use client";
import { useReducer, useEffect } from "react";
import Button from "./Button";
import { isQuestCompleted } from "../lib/questStorage";
import { useTranslation } from "react-i18next";
import useQueryParams from "../lib/useQueryParams";
import { FLOAT_ANIMATION_CSS } from "../lib/animations";

export default function QuestCard({ questId, titleText, descriptionText, index = 0 }) {
    const delay = index * 0.2;
    const [, forceQuestCompletionRefresh] = useReducer((prev) => prev + 1, 0);
    const isCompleted = isQuestCompleted(questId);
    const { t } = useTranslation();
    const { buildQueryString } = useQueryParams();
    // Pass this card's questId explicitly; questId: null clears any stale value first
    const queryString = buildQueryString({ questId });

    useEffect(() => {
        const handleStorageChange = () => {
            forceQuestCompletionRefresh();
        };

        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("questCompleted", handleStorageChange);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("questCompleted", handleStorageChange);
        };
    }, [questId]);

    return (
        <div className="max-w-sm w-full lg:max-w-full lg:flex p-4">
            <style>{FLOAT_ANIMATION_CSS}</style>
            <div
                className="border-2 border-purple-300 bg-white/90 backdrop-blur-sm shadow-lg rounded-lg p-4 flex flex-col justify-between leading-normal hover:shadow-xl transition-shadow float-animation"
                style={{ animationDelay: `${delay}s` }}
            >
                <div className="mb-8">
                    <div className="text-purple-800 font-bold text-xl mb-2 font-silkscreen">{titleText}</div>
                    <p className="text-purple-700 text-base font-silkscreen">{descriptionText}</p>
                    <div className="mt-4">
                        {isCompleted ? (
                            <button
                                className="inline-flex items-center w-auto text-white bg-green-600 shadow-md font-medium leading-5 rounded-lg text-sm px-4 py-2.5 cursor-default font-silkscreen"
                                disabled
                            >
                                ✓ {t("quest.completed")}
                            </button>
                        ) : (
                            <Button
                                link={`/pinpage${queryString}`}
                                text="Enter Pin"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
